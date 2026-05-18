import { describe, it, beforeEach, afterEach } from "node:test";
import { deepStrictEqual } from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadSettings, mergeRepoSettings } from "../src/settings.ts";

describe("mergeRepoSettings", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "rs-merge-"));
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
    deepStrictEqual(mergeRepoSettings([join(tmp, "missing.json"), null]), {});
  });

  it("reads a single tier", () => {
    const p = write("user.json", { repoSettings: { worktreeTemplate: "x" } });
    deepStrictEqual(mergeRepoSettings([p]), { worktreeTemplate: "x" });
  });

  it("higher-priority tier overrides same field", () => {
    const user = write("user.json", {
      repoSettings: { worktreeTemplate: "user-path" },
    });
    const project = write("project.json", {
      repoSettings: { worktreeTemplate: "project-path" },
    });
    // Lowest priority first; later overrides earlier.
    deepStrictEqual(mergeRepoSettings([user, project]), {
      worktreeTemplate: "project-path",
    });
  });

  it("fields from lower tiers survive when higher tier sets different fields", () => {
    const user = write("user.json", {
      repoSettings: {
        worktreeTemplate: "user-path",
        branchTemplate: "user-branch",
      },
    });
    const project = write("project.json", {
      repoSettings: { branchTemplate: "project-branch" },
    });
    const local = write("local.json", {
      repoSettings: { gateEnvVar: "FOO" },
    });
    deepStrictEqual(mergeRepoSettings([user, project, local]), {
      worktreeTemplate: "user-path",
      branchTemplate: "project-branch",
      gateEnvVar: "FOO",
    });
  });

  it("reads cloneTemplate field (consumed by fnclaude, not this plugin)", () => {
    const p = write("user.json", {
      repoSettings: {
        worktreeTemplate: "~/src/{repo}@{owner}+{branch}",
        cloneTemplate: "~/src/{repo}@{owner}",
      },
    });
    deepStrictEqual(mergeRepoSettings([p]), {
      worktreeTemplate: "~/src/{repo}@{owner}+{branch}",
      cloneTemplate: "~/src/{repo}@{owner}",
    });
  });

  it("skips files with malformed JSON", () => {
    const bad = join(tmp, "bad.json");
    writeFileSync(bad, "{not valid json");
    const good = write("good.json", {
      repoSettings: { worktreeTemplate: "kept" },
    });
    deepStrictEqual(mergeRepoSettings([bad, good]), {
      worktreeTemplate: "kept",
    });
  });

  it("skips files without repoSettings key", () => {
    const other = write("other.json", { somethingElse: true });
    const real = write("real.json", {
      repoSettings: { worktreeTemplate: "kept" },
    });
    deepStrictEqual(mergeRepoSettings([other, real]), {
      worktreeTemplate: "kept",
    });
  });

  it("treats null entries (e.g. unavailable managed tier) as skipped", () => {
    const user = write("user.json", {
      repoSettings: { worktreeTemplate: "user-path" },
    });
    deepStrictEqual(mergeRepoSettings([user, null]), {
      worktreeTemplate: "user-path",
    });
  });
});

describe("loadSettings", () => {
  let tmp: string;
  let originalHome: string | undefined;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "rs-load-"));
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
      JSON.stringify({ repoSettings: { worktreeTemplate: "user-only" } }),
    );
    const projectRoot = join(tmp, "repo");
    mkdirSync(projectRoot, { recursive: true });
    deepStrictEqual(loadSettings(projectRoot), {
      worktreeTemplate: "user-only",
    });
  });

  it("project overrides user; local overrides project", () => {
    writeFileSync(
      join(tmp, "home", ".claude", "settings.json"),
      JSON.stringify({
        repoSettings: {
          worktreeTemplate: "user-path",
          branchTemplate: "user-branch",
        },
      }),
    );
    const projectRoot = join(tmp, "repo");
    mkdirSync(join(projectRoot, ".claude"), { recursive: true });
    writeFileSync(
      join(projectRoot, ".claude", "settings.json"),
      JSON.stringify({
        repoSettings: { branchTemplate: "project-branch" },
      }),
    );
    writeFileSync(
      join(projectRoot, ".claude", "settings.local.json"),
      JSON.stringify({
        repoSettings: { gateEnvVar: "LOCAL_FLAG" },
      }),
    );
    deepStrictEqual(loadSettings(projectRoot), {
      worktreeTemplate: "user-path",
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
