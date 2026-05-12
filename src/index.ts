#!/usr/bin/env node

// claude-code-worktree-paths
// WorktreeCreate hook: places worktrees at ~/src/<repo>@<user>+<wtname>/
// when FNCLAUDE_INVOCATION is set; otherwise uses Claude Code's default layout.
// https://github.com/fnrhombus/claude-code-worktree-paths

import { execSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import { runHook } from "@fnrhombus/claude-code-hooks";

// ---------------------------------------------------------------------------
// Typed wrapper — @fnrhombus/claude-code-hooks includes WorktreeCreateInput
// with a `name` field and common fields (cwd, session_id, etc.).
// The `cwd` field is the repo root at the time the hook fires.
//
// NOTE: the hook returns a `worktreePath` via the hookSpecificOutput envelope
// (for HTTP hooks that's the JSON field; for command hooks Claude Code reads
// stdout). The wrapper handles the envelope; we just return { worktreePath }.
// ---------------------------------------------------------------------------

runHook({
  worktreeCreate: (input) => {
    const { name, cwd } = input;

    // Resolve the git repo root from cwd (cwd is the project root at hook time).
    let repoRoot: string;
    try {
      repoRoot = execSync("git rev-parse --show-toplevel", {
        cwd,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();
    } catch {
      // Fall back to cwd if git command fails (shouldn't happen in normal use).
      process.stderr.write(
        `claude-code-worktree-paths: git rev-parse failed in ${cwd}, using cwd as repo root\n`,
      );
      repoRoot = cwd;
    }

    let targetDir: string;
    let targetBranch: string;

    if (process.env["FNCLAUDE_INVOCATION"]) {
      // Tom's convention: ~/src/<repoSlug>+<wtname>
      //
      // repo_root basename may already be <repo>@<user>+<something> when
      // the worktree's parent is itself a worktree. Strip any existing
      // +<workspace> suffix so we don't accumulate +wt+wt+wt.
      const repoBasename = basename(repoRoot);
      const repoSlug = repoBasename.includes("+")
        ? repoBasename.slice(0, repoBasename.indexOf("+"))
        : repoBasename;

      targetDir = join(process.env["HOME"] ?? "/root", "src", `${repoSlug}+${name}`);
      targetBranch = name;

      process.stderr.write(
        `claude-code-worktree-paths: fnclaude mode — ${targetDir} on branch ${targetBranch}\n`,
      );
    } else {
      // Default Claude Code layout
      targetDir = join(repoRoot, ".claude", "worktrees", name);
      targetBranch = `worktree-${name}`;

      process.stderr.write(
        `claude-code-worktree-paths: default mode — ${targetDir} on branch ${targetBranch}\n`,
      );
    }

    // Sanity check: target must not already exist.
    if (existsSync(targetDir)) {
      throw new Error(
        `claude-code-worktree-paths: target directory already exists: ${targetDir}`,
      );
    }

    // Ensure parent directory exists.
    mkdirSync(dirname(targetDir), { recursive: true });

    // Check whether the branch already exists locally.
    const branchExists = branchExistsLocally(repoRoot, targetBranch);

    // Build the worktree add command.
    const args = branchExists
      ? ["worktree", "add", targetDir, targetBranch]
      : ["worktree", "add", "-b", targetBranch, targetDir];

    const label = branchExists
      ? `checkout existing branch '${targetBranch}'`
      : `create branch '${targetBranch}'`;
    process.stderr.write(`claude-code-worktree-paths: ${label}\n`);

    try {
      const output = execSync(["git", "-C", repoRoot, ...args].join(" "), {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      if (output) process.stderr.write(output);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : String(err);
      throw new Error(`claude-code-worktree-paths: git worktree add failed: ${msg}`);
    }

    if (!existsSync(targetDir)) {
      throw new Error(
        `claude-code-worktree-paths: git worktree add succeeded but ${targetDir} does not exist`,
      );
    }

    // The typed wrapper writes { hookSpecificOutput: { hookEventName: "WorktreeCreate",
    // worktreePath: targetDir } } to stdout, which Claude Code reads as the worktree path.
    return { worktreePath: targetDir };
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function branchExistsLocally(repoRoot: string, branch: string): boolean {
  try {
    execSync(
      `git -C ${JSON.stringify(repoRoot)} show-ref --verify --quiet refs/heads/${JSON.stringify(branch)}`,
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    return true;
  } catch {
    return false;
  }
}
