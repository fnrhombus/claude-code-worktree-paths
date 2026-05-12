# claude-code-worktree-paths

**Claude Code defaults to dumping worktrees into `.claude/worktrees/<name>/` with a `worktree-<name>` branch. This plugin overrides that to put worktrees exactly where you want them.**

[![license](https://img.shields.io/npm/l/claude-code-worktree-paths)](./LICENSE)

<!--
  This README is advertising, not documentation. Lead with the pain point
  and the before/after.
-->

## The problem

When you launch Claude Code with `--worktree myfeature`, you get:

```
your-repo/
  .claude/
    worktrees/
      myfeature/      ← worktree lands here, branch is "worktree-myfeature"
```

That's fine if everyone on a team shares the same layout. It's a problem if you want worktrees to live somewhere else — like alongside the main repo as siblings, with a clean branch name, without touching `.claude/` at all.

## The fix

With this plugin and `FNCLAUDE_INVOCATION` set, `--worktree myfeature` on `your-repo@you` gives:

```
~/src/
  your-repo@you/           ← main checkout
  your-repo@you+myfeature/ ← worktree lands here, branch is "myfeature"
```

Before:
```
/home/tom/projects/my-app/.claude/worktrees/myfeature/   (branch: worktree-myfeature)
```

After:
```
/home/tom/src/my-app@you+myfeature/   (branch: myfeature)
```

**Env-var gated.** The plugin is transparent when `FNCLAUDE_INVOCATION` is unset — it falls back to Claude Code's default layout. Set the variable in whatever wrapper script or shell alias invokes Claude Code for your personal workflow.

## How it works

- Reads `WorktreeCreate` hook input (the worktree `name` and the repo `cwd`).
- Resolves the git root from `cwd`. Strips any `+<suffix>` from the repo basename so worktrees-of-worktrees don't accumulate `+wt+wt`.
- Calls `git worktree add` with the computed path and branch. If the branch already exists locally, checks it out without `-b`.
- Outputs the absolute path so Claude Code knows where the worktree landed.

## Install

```
/plugin marketplace add fnrhombus/claude-plugins
/plugin install claude-code-worktree-paths@fnrhombus-plugins
```

## License

MIT
