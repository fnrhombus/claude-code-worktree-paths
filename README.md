# claude-code-worktree-paths

**`claude --worktree foo` puts worktrees in the wrong place. Template your way out.**

[![license](https://img.shields.io/npm/l/claude-code-worktree-paths)](./LICENSE)

Claude Code's default `WorktreeCreate` behavior drops a worktree at `.claude/worktrees/<name>/` inside the repo, on a branch named `worktree-<name>`. If you want worktrees somewhere else — as siblings in `~/src/`, under a different naming scheme, on a clean branch name — this plugin lets you template both the path and the branch via `~/.claude/settings.json`.

## Before / after

```
# Default: worktree buried inside the repo, branch gets a prefix
~/src/my-app/
  .claude/worktrees/feature/   (branch: worktree-feature)

# With worktreeTemplate "~/src/{repo}@{owner}+{branch}" and branchTemplate "{input}":
~/src/my-app/                         (main checkout)
~/src/my-app@you+feature/             (branch: feature)
```

No config, no change:

```
# Without worktreeTemplate or branchTemplate set, behavior is identical to vanilla Claude Code:
~/src/my-app/
  .claude/worktrees/feature/   (branch: worktree-feature)
```

Installing without configuring is a no-op.

## Config

Add a `repoSettings` block to any [Claude Code settings file](https://code.claude.com/docs/en/settings):

```json
"repoSettings": {
  "worktreeTemplate": "~/src/{repo}@{owner}+{branch}",
  "branchTemplate":   "{input}",
  "cloneTemplate":    "~/src/{repo}@{owner}",
  "gateEnvVar":       "FNCLAUDE_INVOCATION"
}
```

All four keys are optional. Omit any you don't need.

- `worktreeTemplate` — where the worktree directory lands. Read by this plugin.
- `branchTemplate` — what the worktree's branch is named. Read by this plugin.
- `cloneTemplate` — where clones land. **Read by [fnclaude](https://github.com/fnrhombus/fnclaude), not this plugin** — included here so the schema is centrally documented. Defining it without fnclaude installed is harmless (the plugin ignores it).
- `gateEnvVar` — name of an env var; templates only apply when that var is present in the process invoking Claude. Lets a single Claude install have two behaviors.

### Scopes

The plugin reads `repoSettings` from the same four tiers Claude Code itself uses, in the same precedence order (highest → lowest):

| Tier | Path | Use for |
|---|---|---|
| Managed | `/etc/claude-code/managed-settings.json` (Linux), `/Library/Application Support/ClaudeCode/managed-settings.json` (macOS), `%ProgramData%\ClaudeCode\managed-settings.json` (Windows) | IT-deployed overrides |
| Local | `<repo>/.claude/settings.local.json` | Your local-only project tweaks (gitignored) |
| Project | `<repo>/.claude/settings.json` | Team-shared per-project layout (committed) |
| User | `~/.claude/settings.json` | Your default across all projects |

Tiers are **shallow-merged per field**, not whole-block-replaced. So a project that sets only `branchTemplate` keeps your user-level `worktreeTemplate` intact — set just the keys you want to override. (This is a small deviation from Claude Code's default whole-key override, picked because per-template independence is what people actually want here.)

### Placeholders

Available in both `worktreeTemplate` and `branchTemplate`:

| Placeholder | Value |
|---|---|
| `{input}` | What the user typed after `--worktree` |
| `{owner}` | Owner from `git remote get-url origin` |
| `{repo}` | Repo name from the same; falls back to the local directory basename if there is no remote |
| `{repo-dir}` | Basename of the local repo root (often equal to `{repo}`, but captures local naming like `myrepo@me`) |
| `{clone-path}` | Absolute path of the actual repo root. Lets `worktreeTemplate` sibling the clone without restating the prefix — e.g. `worktreeTemplate: "{clone-path}+{branch}"` paired with `cloneTemplate: "~/src/{repo}@{owner}"` produces `~/src/my-app@me/` for clones and `~/src/my-app@me+feature/` for worktrees. |
| `{cwd}` | Basename of the directory Claude was invoked from |
| `{host}` | Full hostname from the remote URL (e.g. `github.com`, `gitlab.com`, `git.example.com`) |
| `{host-plain}` | TLD-stripped host (`github` for `github.com`, `git` for `git.example.com`). Always available, algorithmic. |
| `{host-short}` | Short alias (`gh`, `gl`, etc.) per the [host-aliases LUT](#host-short-aliases). Errors with instructions if unconfigured for the current host. |

`{branch}` is also available in `worktreeTemplate` — it resolves to the branch name produced by `branchTemplate`.

### Host-short aliases

`{host-short}` looks up the current host in a JSON file. Two locations are read, merged with user-level winning:

| Path | Notes |
|---|---|
| `/usr/share/fnrhombus/host-aliases.json` | System-wide, ships with [fnclaude](https://github.com/fnrhombus/fnclaude). Root-owned. |
| `~/.local/share/fnrhombus/host-aliases.json` | User-level, optional override. Per-key precedence over the system file. |

The plugin does **not** ship either file. Both missing → `{host-short}` errors when used, with instructions naming the two paths and a JSON example to copy.

File format (either location):

```json
{
  "github.com":    "gh",
  "gitlab.com":    "gl",
  "bitbucket.org": "bb",
  "codeberg.org":  "cb"
}
```

If your template doesn't reference `{host-short}`, the LUT is never read.

### Defaults

| Setting | Default |
|---|---|
| `worktreeTemplate` | `.claude/worktrees/{input}` |
| `branchTemplate` | `worktree-{input}` |

These match Claude Code's native behavior exactly.

### Path resolution

- Starts with `/` — absolute path, used as-is.
- Starts with `~/` — `~` expands to `$HOME` (via `os.homedir()`; cross-platform).
- Anything else — relative to `git rev-parse --show-toplevel`.

So `.claude/worktrees/{input}`, `../{repo}+{input}`, and `~/src/{repo}+{input}` all work.

### Gate

`gateEnvVar` is optional. If set, the templates only apply when that environment variable is present in the process that invoked Claude. Without it, the plugin falls back to Claude's defaults. This lets a single Claude install have two behaviors — custom layout when launched via your wrapper, default when launched directly.

If `gateEnvVar` is omitted, templates always apply.

## No-remote repos

If your repo has no `origin` remote and you use `{repo}`, the plugin falls back to the local directory basename. Using `{owner}`, `{host}`, `{host-plain}`, or `{host-short}` with no remote is an error — the plugin will abort with a clear message.

## Install

Inside Claude Code:

```
/plugin marketplace add fnrhombus/claude-plugins
/plugin install claude-code-worktree-paths@fnrhombus-plugins
```

## License

MIT
