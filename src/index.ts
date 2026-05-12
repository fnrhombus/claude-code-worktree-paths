#!/usr/bin/env node

// claude-code-worktree-paths — WorktreeCreate hook with templated path/branch.
// Reads ~/.claude/settings.json for `worktreePaths.{pathTemplate,branchTemplate,gateEnvVar}`.
// Defaults match Claude Code's native behavior, so installing without configuring is a no-op.
//
// Performance: avoids the @fnrhombus/claude-code-hooks runtime (its dispatch/
// abstraction layer adds parse cost we don't need for a single-event hook),
// uses CLAUDE_PROJECT_DIR to skip `git rev-parse`, and skips `git remote` when
// templates don't reference {owner}/{repo}. The plugin is on the synchronous
// path between user keystroke and worktree creation; every fork-saved is felt.
//
// https://github.com/fnrhombus/claude-code-worktree-paths

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, normalize } from "node:path";

const DEFAULT_PATH_TEMPLATE = ".claude/worktrees/{input}";
const DEFAULT_BRANCH_TEMPLATE = "worktree-{input}";

interface Settings {
  pathTemplate?: string;
  branchTemplate?: string;
  gateEnvVar?: string;
}

function main(): void {
  const input = JSON.parse(readFileSync(0, "utf8")) as {
    worktree_name?: string;
    name?: string;
    cwd?: string;
    base_commit?: string;
  };

  const wtName = input.worktree_name ?? input.name;
  if (!wtName) throw new Error("worktree_name missing from hook input");
  const cwd = input.cwd ?? process.cwd();
  const baseCommit = input.base_commit;

  const settings = loadSettings();
  const gateUnsatisfied =
    settings.gateEnvVar !== undefined && !process.env[settings.gateEnvVar];

  const pathTpl = gateUnsatisfied
    ? DEFAULT_PATH_TEMPLATE
    : settings.pathTemplate ?? DEFAULT_PATH_TEMPLATE;
  const branchTpl = gateUnsatisfied
    ? DEFAULT_BRANCH_TEMPLATE
    : settings.branchTemplate ?? DEFAULT_BRANCH_TEMPLATE;

  // Claude Code provides CLAUDE_PROJECT_DIR; falling back to git rev-parse
  // costs ~10ms per fork on hot disk and is the bottleneck of the no-config path.
  const repoRoot =
    process.env["CLAUDE_PROJECT_DIR"] ?? gitRepoRoot(cwd);
  const repoDir = basename(repoRoot);
  const cwdLeaf = basename(cwd);

  // Lazy: skip the git remote fork unless the templates actually need it.
  const needRemote = ownerOrRepoUsed(pathTpl) || ownerOrRepoUsed(branchTpl);
  const remote = needRemote ? parseRemote(repoRoot) : null;

  if (
    !remote &&
    (pathTpl.includes("{owner}") || branchTpl.includes("{owner}"))
  ) {
    throw new Error("template uses {owner} but repo has no `origin` remote");
  }

  const vars: Record<string, string> = {
    input: wtName,
    owner: remote?.owner ?? "",
    repo: remote?.repo ?? repoDir,
    "repo-dir": repoDir,
    cwd: cwdLeaf,
  };

  const branch = applyTemplate(branchTpl, vars);
  vars["branch"] = branch;
  const targetDir = resolvePath(applyTemplate(pathTpl, vars), repoRoot);

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
    throw new Error(
      `git worktree add failed: ${(err as Error).message}`,
    );
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

function loadSettings(): Settings {
  const path = join(homedir(), ".claude", "settings.json");
  if (!existsSync(path)) return {};
  try {
    const j = JSON.parse(readFileSync(path, "utf8")) as {
      worktreePaths?: Settings;
    };
    return j.worktreePaths ?? {};
  } catch {
    return {};
  }
}

function ownerOrRepoUsed(tpl: string): boolean {
  return tpl.includes("{owner}") || tpl.includes("{repo}");
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
): { owner: string; repo: string } | null {
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
  // git@host:owner/repo.git, https://host/owner/repo[.git], ssh://git@host/owner/repo.git
  const m = url.match(/[:/]([^/:]+)\/([^/]+?)(?:\.git)?\/?$/);
  if (!m || !m[1] || !m[2]) return null;
  return { owner: m[1], repo: m[2] };
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

function applyTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{([a-z][a-z-]*)\}/g, (_m, k: string) => {
    if (!(k in vars)) {
      throw new Error(`unknown placeholder {${k}} in "${tpl}"`);
    }
    return vars[k] as string;
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
