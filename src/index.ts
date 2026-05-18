#!/usr/bin/env node

// claude-code-worktree-paths — WorktreeCreate hook with templated path/branch.
// Reads `repoSettings.{worktreeTemplate,branchTemplate,gateEnvVar}` from
// Claude Code's four settings tiers (managed > local > project > user,
// shallow-merged per field — see src/settings.ts). Defaults match Claude
// Code's native behavior, so installing without configuring is a no-op.
//
// Performance: avoids the @fnrhombus/claude-code-hooks runtime (its dispatch/
// abstraction layer adds parse cost we don't need for a single-event hook),
// uses CLAUDE_PROJECT_DIR to skip `git rev-parse`, and skips `git remote` when
// templates don't reference {owner}/{repo}/{host*}. The plugin is on the
// synchronous path between user keystroke and worktree creation; every
// fork-saved is felt.
//
// https://github.com/fnrhombus/claude-code-worktree-paths

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, normalize } from "node:path";

import { loadHostAliases, missingHostShortError } from "./host-aliases";
import { sanitizeForPath } from "./sanitize";
import { loadSettings } from "./settings";

const DEFAULT_WORKTREE_TEMPLATE = ".claude/worktrees/{input}";
const DEFAULT_BRANCH_TEMPLATE = "worktree-{input}";

function main(): void {
  const input = JSON.parse(readFileSync(0, "utf8")) as {
    worktree_name?: string;
    name?: string;
    cwd?: string;
    base_commit?: string;
  };

  const rawName = input.worktree_name ?? input.name;
  if (!rawName) throw new Error("worktree_name missing from hook input");
  // Scrub path-illegal / branch-illegal chars before they reach the filesystem
  // or git. Throws with a clear message if the name reduces to empty.
  const wtName = sanitizeForPath(rawName);
  const cwd = input.cwd ?? process.cwd();
  const baseCommit = input.base_commit;

  // Claude Code provides CLAUDE_PROJECT_DIR; falling back to git rev-parse
  // costs ~10ms per fork on hot disk and is the bottleneck of the no-config path.
  const repoRoot = process.env["CLAUDE_PROJECT_DIR"] ?? gitRepoRoot(cwd);
  const repoDir = basename(repoRoot);
  const cwdLeaf = basename(cwd);

  // Settings load happens after repoRoot is known so the project + local
  // tiers anchor to the same directory Claude Code resolves them against.
  const settings = loadSettings(repoRoot);
  const gateUnsatisfied =
    settings.gateEnvVar !== undefined && !process.env[settings.gateEnvVar];

  const worktreeTpl = gateUnsatisfied
    ? DEFAULT_WORKTREE_TEMPLATE
    : settings.worktreeTemplate ?? DEFAULT_WORKTREE_TEMPLATE;
  const branchTpl = gateUnsatisfied
    ? DEFAULT_BRANCH_TEMPLATE
    : settings.branchTemplate ?? DEFAULT_BRANCH_TEMPLATE;

  // Lazy: skip the git remote fork unless the templates actually need it.
  const needRemote = remoteVarsUsed(worktreeTpl) || remoteVarsUsed(branchTpl);
  const remote = needRemote ? parseRemote(repoRoot) : null;

  if (
    !remote &&
    (worktreeTpl.includes("{owner}") || branchTpl.includes("{owner}"))
  ) {
    throw new Error("template uses {owner} but repo has no `origin` remote");
  }

  const host = remote?.host ?? "";
  const hostPlain = host.includes(".") ? host.split(".")[0]! : host;

  // Lazy LUT load + resolution: only fires if a template actually uses
  // {host-short}. Keeps the no-config path free of file IO.
  const aliasesGetter = (() => {
    let cached: Record<string, string> | null = null;
    return () => {
      if (cached === null) cached = loadHostAliases();
      return cached;
    };
  })();

  const vars: Record<string, () => string> = {
    input: () => wtName,
    owner: () => remote?.owner ?? "",
    repo: () => remote?.repo ?? repoDir,
    "repo-dir": () => repoDir,
    "clone-path": () => repoRoot,
    cwd: () => cwdLeaf,
    host: () => host,
    "host-plain": () => hostPlain,
    "host-short": () => {
      const map = aliasesGetter();
      if (!(host in map)) throw missingHostShortError(host);
      return map[host]!;
    },
  };

  const branch = applyTemplate(branchTpl, vars);
  vars["branch"] = () => branch;
  const targetDir = resolvePath(applyTemplate(worktreeTpl, vars), repoRoot);

  if (existsSync(targetDir)) {
    throw new Error(`target already exists: ${targetDir}`);
  }
  mkdirSync(dirname(targetDir), { recursive: true });

  const branchExists = branchExistsLocally(repoRoot, branch);
  const args = branchExists
    ? ["-C", repoRoot, "worktree", "add", targetDir, branch]
    : [
        "-C",
        repoRoot,
        "worktree",
        "add",
        "-b",
        branch,
        targetDir,
        ...(baseCommit ? [baseCommit] : []),
      ];

  process.stderr.write(
    `claude-code-worktree-paths: ${branchExists ? "checkout" : "create"} '${branch}' at ${targetDir}\n`,
  );

  try {
    const out = execFileSync("git", args, { encoding: "utf8" });
    if (out) process.stderr.write(out);
  } catch (err) {
    throw new Error(`git worktree add failed: ${(err as Error).message}`);
  }

  if (!existsSync(targetDir)) {
    throw new Error(
      `git worktree add succeeded but ${targetDir} does not exist`,
    );
  }

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "WorktreeCreate",
        worktreePath: targetDir,
      },
    }),
  );
}

function remoteVarsUsed(tpl: string): boolean {
  return (
    tpl.includes("{owner}") ||
    tpl.includes("{repo}") ||
    tpl.includes("{host}") ||
    tpl.includes("{host-plain}") ||
    tpl.includes("{host-short}")
  );
}

function gitRepoRoot(cwd: string): string {
  try {
    return execFileSync("git", ["-C", cwd, "rev-parse", "--show-toplevel"], {
      encoding: "utf8",
    }).trim();
  } catch {
    return cwd;
  }
}

function parseRemote(
  repoRoot: string,
): { host: string; owner: string; repo: string } | null {
  let url: string;
  try {
    url = execFileSync(
      "git",
      ["-C", repoRoot, "remote", "get-url", "origin"],
      { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
    ).trim();
  } catch {
    return null;
  }
  // Forms supported:
  //   git@host:owner/repo[.git]
  //   https://host/owner/repo[.git]
  //   ssh://git@host/owner/repo[.git]
  //   ssh://host/owner/repo[.git]
  const m = url.match(
    /^(?:git@|(?:https?|ssh):\/\/(?:[^@/]+@)?)([^:/]+)[:/]([^/]+)\/([^/]+?)(?:\.git)?\/?$/,
  );
  if (!m || !m[1] || !m[2] || !m[3]) return null;
  return { host: m[1], owner: m[2], repo: m[3] };
}

function branchExistsLocally(repoRoot: string, branch: string): boolean {
  try {
    execFileSync(
      "git",
      [
        "-C",
        repoRoot,
        "show-ref",
        "--verify",
        "--quiet",
        `refs/heads/${branch}`,
      ],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    return true;
  } catch {
    return false;
  }
}

function applyTemplate(
  tpl: string,
  vars: Record<string, () => string>,
): string {
  return tpl.replace(/\{([a-z][a-z-]*)\}/g, (_m, k: string) => {
    if (!(k in vars)) {
      throw new Error(`unknown placeholder {${k}} in "${tpl}"`);
    }
    return vars[k]!();
  });
}

function resolvePath(tpl: string, repoRoot: string): string {
  let raw = tpl;
  if (raw === "~") raw = homedir();
  else if (raw.startsWith("~/")) raw = join(homedir(), raw.slice(2));
  return normalize(isAbsolute(raw) ? raw : join(repoRoot, raw));
}

try {
  main();
} catch (err) {
  process.stderr.write(
    `claude-code-worktree-paths: ${(err as Error).message}\n`,
  );
  process.exit(2);
}
