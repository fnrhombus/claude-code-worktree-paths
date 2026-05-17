import { describe, it, beforeEach, afterEach } from "node:test";
import { deepStrictEqual } from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadSettings, mergeWorktreePaths } from "../src/settings.ts";

describe("mergeWorktreePaths", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "wtp-merge-"));
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  const write = (name: string, body: object): string => {
    const p = join(tmp, name);
    writeFileSync(p, JSON.stringify(body));
    return p;
  };

  it("returns empty when no paths exist", () => {
    deepStrictEqual(mergeWorktreePaths([join(tmp, "missing.json"), null]), {});
  });

  it("reads a single tier", () => {
    const p = write("user.json", { worktreePaths: { pathTemplate: "x" } });
    deepStrictEqual(mergeWorktreePaths([p]), { pathTemplate: "x" });
  });

  it("higher-priority tier overrides same field", () => {
    const user = write("user.json", {
      worktreePaths: { pathTemplate: "user-path" },
    });
    const project = write("project.json", {
      worktreePaths: { pathTemplate: "project-path" },
    });
    // Lowest priority first; later overrides earlier.
    deepStrictEqual(mergeWorktreePaths([user, project]), {
      pathTemplate: "project-path",
    });
  });

  it("fields from lower tiers survive when higher tier sets different fields", () => {
    const user = write("user.json", {
      worktreePaths: {
        pathTemplate: "user-path",
        branchTemplate: "user-branch",
      },
    });
    const project = write("project.json", {
      worktreePaths: { branchTemplate: "project-branch" },
    });
    const local = write("local.json", {
      worktreePaths: { gateEnvVar: "FOO" },
    });
    deepStrictEqual(mergeWorktreePaths([user, project, local]), {
      pathTemplate: "user-path",
      branchTemplate: "project-branch",
      gateEnvVar: "FOO",
    });
  });

  it("skips files with malformed JSON", () => {
    const bad = join(tmp, "bad.json");
    writeFileSync(bad, "{not valid json");
    const good = write("good.json", {
      worktreePaths: { pathTemplate: "kept" },
    });
    deepStrictEqual(mergeWorktreePaths([bad, good]), { pathTemplate: "kept" });
  });

  it("skips files without worktreePaths key", () => {
    const other = write("other.json", { somethingElse: true });
    const real = write("real.json", {
      worktreePaths: { pathTemplate: "kept" },
    });
    deepStrictEqual(mergeWorktreePaths([other, real]), {
      pathTemplate: "kept",
    });
  });

  it("treats null entries (e.g. unavailable managed tier) as skipped", () => {
    const user = write("user.json", {
      worktreePaths: { pathTemplate: "user-path" },
    });
    deepStrictEqual(mergeWorktreePaths([user, null]), {
      pathTemplate: "user-path",
    });
  });
});

describe("loadSettings", () => {
  let tmp: string;
  let originalHome: string | undefined;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "wtp-load-"));
    originalHome = process.env["HOME"];
    process.env["HOME"] = join(tmp, "home");
    mkdirSync(join(tmp, "home", ".claude"), { recursive: true });
  });
  afterEach(() => {
    if (originalHome === undefined) delete process.env["HOME"];
    else process.env["HOME"] = originalHome;
    rmSync(tmp, { recursive: true, force: true });
  });

  it("reads user settings when no project tier exists", () => {
    writeFileSync(
      join(tmp, "home", ".claude", "settings.json"),
      JSON.stringify({ worktreePaths: { pathTemplate: "user-only" } }),
    );
    const projectRoot = join(tmp, "repo");
    mkdirSync(projectRoot, { recursive: true });
    deepStrictEqual(loadSettings(projectRoot), { pathTemplate: "user-only" });
  });

  it("project overrides user; local overrides project", () => {
    writeFileSync(
      join(tmp, "home", ".claude", "settings.json"),
      JSON.stringify({
        worktreePaths: {
          pathTemplate: "user-path",
          branchTemplate: "user-branch",
        },
      }),
    );
    const projectRoot = join(tmp, "repo");
    mkdirSync(join(projectRoot, ".claude"), { recursive: true });
    writeFileSync(
      join(projectRoot, ".claude", "settings.json"),
      JSON.stringify({
        worktreePaths: { branchTemplate: "project-branch" },
      }),
    );
    writeFileSync(
      join(projectRoot, ".claude", "settings.local.json"),
      JSON.stringify({
        worktreePaths: { gateEnvVar: "LOCAL_FLAG" },
      }),
    );
    deepStrictEqual(loadSettings(projectRoot), {
      pathTemplate: "user-path",
      branchTemplate: "project-branch",
      gateEnvVar: "LOCAL_FLAG",
    });
  });

  it("returns empty settings when no tier exists", () => {
    const projectRoot = join(tmp, "repo");
    mkdirSync(projectRoot, { recursive: true });
    deepStrictEqual(loadSettings(projectRoot), {});
  });
});
