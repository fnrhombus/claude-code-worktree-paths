// Load the {host-short} alias map from up to two layered files. System-level
// file ships with fnclaude (which is the canonical source for the defaults);
// user-level file optionally overrides per-key. Both files are JSON objects
// mapping fully-qualified host → short alias, e.g. `{"github.com": "gh"}`.
//
// Missing files are silently treated as empty maps — the plugin doesn't ship
// either file itself, just reads them if present. If a user template uses
// {host-short} and the merged map has no entry for the current host, the
// substitution step errors with instructions naming both file paths.

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type HostAliases = Record<string, string>;

export const SYSTEM_ALIASES_PATH = "/usr/share/fnrhombus/host-aliases.json";

export function userAliasesPath(): string {
  return join(homedir(), ".local", "share", "fnrhombus", "host-aliases.json");
}

/**
 * Read both files (if present) and merge them, user-level winning per key.
 * Either or both missing returns the available map (or empty). Malformed
 * JSON in either is silently ignored — same fail-soft posture as the
 * settings reader.
 */
export function loadHostAliases(): HostAliases {
  const sys = readAliases(SYSTEM_ALIASES_PATH);
  const usr = readAliases(userAliasesPath());
  return { ...sys, ...usr };
}

function readAliases(path: string): HostAliases {
  if (!existsSync(path)) return {};
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {};
    }
    const out: HostAliases = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "string") out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Build the error message emitted when a template uses {host-short} but no
 * alias is configured for the current host. Named function so both consumers
 * (plugin and fnclaude) can produce the same shape if desired.
 */
export function missingHostShortError(host: string): Error {
  return new Error(
    `cannot resolve {host-short} for host "${host}": no alias configured.\n` +
      `Add an entry to one of:\n` +
      `  ${SYSTEM_ALIASES_PATH}  (system, requires sudo)\n` +
      `  ${userAliasesPath()}  (user-level, takes precedence on conflict)\n` +
      `Example:\n` +
      `  { "github.com": "gh", "gitlab.com": "gl" }`,
  );
}
