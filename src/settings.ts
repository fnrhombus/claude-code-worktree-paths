// Resolve the `repoSettings` block from Claude Code's four settings tiers,
// shallow-merged per field. Documented precedence (highest → lowest):
//
//   managed > local > project > user
//
// Higher tiers override per-field; fields a tier doesn't set leave lower-tier
// values intact. See https://code.claude.com/docs/en/settings.

import { existsSync, readFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";

export interface RepoSettings {
  /** Template for the worktree path created by claude --worktree. */
  worktreeTemplate?: string;
  /** Template for the branch name created by claude --worktree. */
  branchTemplate?: string;
  /**
   * Template for the clone destination used by fnclaude when it clones a
   * repo before launching a session. This plugin reads the field so the
   * schema is centrally documented, but doesn't act on it — fnclaude is
   * the consumer.
   */
  cloneTemplate?: string;
  /** Env var that gates whether this plugin's templates apply at all. */
  gateEnvVar?: string;
}

export function loadSettings(projectRoot: string): RepoSettings {
  // Lowest priority first; later Object.assign calls overwrite.
  return mergeRepoSettings([
    join(homedir(), ".claude", "settings.json"),
    join(projectRoot, ".claude", "settings.json"),
    join(projectRoot, ".claude", "settings.local.json"),
    managedSettingsPath(),
  ]);
}

export function mergeRepoSettings(paths: Array<string | null>): RepoSettings {
  const merged: RepoSettings = {};
  for (const path of paths) {
    if (path === null) continue;
    Object.assign(merged, readRepoSettings(path));
  }
  return merged;
}

function readRepoSettings(path: string): RepoSettings {
  if (!existsSync(path)) return {};
  try {
    const j = JSON.parse(readFileSync(path, "utf8")) as {
      repoSettings?: RepoSettings;
    };
    return j.repoSettings ?? {};
  } catch {
    return {};
  }
}

function managedSettingsPath(): string | null {
  switch (platform()) {
    case "linux":
      return "/etc/claude-code/managed-settings.json";
    case "darwin":
      return "/Library/Application Support/ClaudeCode/managed-settings.json";
    case "win32": {
      const programData = process.env["ProgramData"];
      return programData
        ? join(programData, "ClaudeCode", "managed-settings.json")
        : null;
    }
    default:
      return null;
  }
}
