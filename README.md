# claude-code-worktree-paths

**`claude --worktree foo` puts worktrees in the wrong place. Template your way out.**

[![license](https://img.shields.io/npm/l/claude-code-worktree-paths)](./LICENSE)

Claude Code's default `WorktreeCreate` behavior drops a worktree at `.claude/worktrees/<name>/` inside the repo, on a branch named `worktree-<name>`. If you want worktrees somewhere else — as siblings in `~/src/`, under a different naming scheme, on a clean branch name — this plugin lets you template both the path and the branch via `~/.claude/settings.json`.

## Before / after

```
# Default: worktree buried inside the repo, branch gets a prefix
~/src/my-app/
  .claude/worktrees/feature/   (branch: worktree-feature)

# With pathTemplate "~/src/{repo}@{owner}+{branch}" and branchTemplate "{input}":
~/src/my-app/                         (main checkout)
~/src/my-app@you+feature/             (branch: feature)
```

No config, no change:

```
# Without pathTemplate or branchTemplate set, behavior is identical to vanilla Claude Code:
~/src/my-app/
  .claude/worktrees/feature/   (branch: worktree-feature)
```

Installing without configuring is a no-op.

## Config

Add a `worktreePaths` block to `~/.claude/settings.json`:

```json
"worktreePaths": {
  "pathTemplate":   "~/src/{repo}@{owner}+{branch}",
  "branchTemplate": "{input}",
  "gateEnvVar":     "FNCLAUDE_INVOCATION"
}
```

All three keys are optional. Omit any you don't need.

### Placeholders

Available in both `pathTemplate` and `branchTemplate`:

| Placeholder | Value |
|---|---|
| `{input}` | What the user typed after `--worktree` |
| `{owner}` | GitHub owner from `git remote get-url origin` |
| `{repo}` | GitHub repo name from the same; falls back to the local directory basename if there is no remote |
| `{repo-dir}` | Basename of the local repo root (often equal to `{repo}`, but captures local naming like `myrepo@me`) |
| `{cwd}` | Basename of the directory Claude was invoked from |

`{branch}` is also available in `pathTemplate` — it resolves to the branch name produced by `branchTemplate`.

### Defaults

| Setting | Default |
|---|---|
| `pathTemplate` | `.claude/worktrees/{input}` |
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

If your repo has no `origin` remote and you use `{repo}`, the plugin falls back to the local directory basename. Using `{owner}` with no remote is an error — the plugin will abort with a clear message.

## Install

Inside Claude Code:

```
/plugin marketplace add fnrhombus/claude-plugins
/plugin install claude-code-worktree-paths@fnrhombus-plugins
```

## License

MIT
