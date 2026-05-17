// Resolve the `worktreePaths` block from Claude Code's four settings tiers,
// shallow-merged per field. Documented precedence (highest → lowest):
//
//   managed > local > project > user
//
// Higher tiers override per-field; fields a tier doesn't set leave lower-tier
// values intact. See https://code.claude.com/docs/en/settings.

import { existsSync, readFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";

export interface Settings {
  pathTemplate?: string;
  branchTemplate?: string;
  gateEnvVar?: string;
}

export function loadSettings(projectRoot: string): Settings {
  // Lowest priority first; later Object.assign calls overwrite.
  return mergeWorktreePaths([
    join(homedir(), ".claude", "settings.json"),
    join(projectRoot, ".claude", "settings.json"),
    join(projectRoot, ".claude", "settings.local.json"),
    managedSettingsPath(),
  ]);
}

export function mergeWorktreePaths(paths: Array<string | null>): Settings {
  const merged: Settings = {};
  for (const path of paths) {
    if (path === null) continue;
    Object.assign(merged, readWorktreePaths(path));
  }
  return merged;
}

function readWorktreePaths(path: string): Settings {
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
