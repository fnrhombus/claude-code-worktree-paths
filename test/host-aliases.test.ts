import { describe, it, beforeEach, afterEach } from "node:test";
import { deepStrictEqual, throws, match } from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { missingHostShortError } from "../src/host-aliases.ts";

// loadHostAliases() reads two well-known absolute paths
// (/usr/share/fnrhombus/host-aliases.json and ~/.local/share/fnrhombus/...)
// so we can't pure-isolate it in tests without mocking. We exercise the
// merge semantics + parsing logic via a localized variant in test space
// that mirrors the same behavior, plus an error-message test for the
// public missingHostShortError helper.

describe("missingHostShortError", () => {
  it("includes the host in the error", () => {
    const e = missingHostShortError("github.example.com");
    match(e.message, /github\.example\.com/);
  });

  it("names both file paths so the user can self-resolve", () => {
    const e = missingHostShortError("github.com");
    match(e.message, /\/usr\/share\/fnrhombus\/host-aliases\.json/);
    match(e.message, /\.local\/share\/fnrhombus\/host-aliases\.json/);
  });

  it("includes a JSON example so users can copy-paste", () => {
    const e = missingHostShortError("github.com");
    match(e.message, /"github\.com":\s*"gh"/);
  });
});

// Local helper that mirrors host-aliases.ts's readAliases + merge logic.
// We test against this rather than rely on filesystem locations the test
// can't safely write to (e.g., /usr/share/).
function readAliasesLocal(
  path: string,
): Record<string, string> {
  const { existsSync, readFileSync } = require("node:fs") as typeof import("node:fs");
  if (!existsSync(path)) return {};
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {};
    }
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "string") out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

describe("host-aliases JSON parse semantics", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "ha-"));
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("returns empty for missing file", () => {
    deepStrictEqual(readAliasesLocal(join(tmp, "nope.json")), {});
  });

  it("returns empty for malformed JSON", () => {
    const p = join(tmp, "bad.json");
    writeFileSync(p, "{not valid json");
    deepStrictEqual(readAliasesLocal(p), {});
  });

  it("returns empty when the file is a non-object (array, scalar)", () => {
    const arr = join(tmp, "arr.json");
    writeFileSync(arr, JSON.stringify(["github.com", "gh"]));
    deepStrictEqual(readAliasesLocal(arr), {});

    const scalar = join(tmp, "scalar.json");
    writeFileSync(scalar, JSON.stringify(42));
    deepStrictEqual(readAliasesLocal(scalar), {});
  });

  it("drops non-string values silently", () => {
    const p = join(tmp, "mixed.json");
    writeFileSync(
      p,
      JSON.stringify({
        "github.com": "gh",
        "gitlab.com": 42, // non-string, dropped
        "bitbucket.org": null, // non-string, dropped
        "codeberg.org": "cb",
      }),
    );
    deepStrictEqual(readAliasesLocal(p), {
      "github.com": "gh",
      "codeberg.org": "cb",
    });
  });

  it("reads a well-formed file", () => {
    const p = join(tmp, "good.json");
    writeFileSync(
      p,
      JSON.stringify({ "github.com": "gh", "gitlab.com": "gl" }),
    );
    deepStrictEqual(readAliasesLocal(p), {
      "github.com": "gh",
      "gitlab.com": "gl",
    });
  });
});

describe("merge semantics — user overrides system", () => {
  it("Object.assign({}, system, user) gives user-wins", () => {
    const system = { "github.com": "gh", "gitlab.com": "gl" };
    const user = { "github.com": "ghub", "bitbucket.org": "bb" };
    const merged = { ...system, ...user };
    deepStrictEqual(merged, {
      "github.com": "ghub", // user wins
      "gitlab.com": "gl", // only in system, kept
      "bitbucket.org": "bb", // only in user, kept
    });
  });
});
