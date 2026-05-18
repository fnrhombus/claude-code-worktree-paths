# Changelog

## [1.0.1](https://github.com/fnrhombus/claude-code-worktree-paths/compare/claude-code-worktree-paths-v1.0.0...claude-code-worktree-paths-v1.0.1) (2026-05-18)


### Bug Fixes

* drop duplicate hooks reference + PAT-gate the release flow ([#12](https://github.com/fnrhombus/claude-code-worktree-paths/issues/12)) ([7fa2f22](https://github.com/fnrhombus/claude-code-worktree-paths/commit/7fa2f220b6ebe9118351c86540ecf8ce71609d80))

## [1.0.0](https://github.com/fnrhombus/claude-code-worktree-paths/compare/claude-code-worktree-paths-v0.5.0...claude-code-worktree-paths-v1.0.0) (2026-05-18)


### ⚠ BREAKING CHANGES

* existing users with `worktreePaths.pathTemplate` in their settings.json need to rename to `repoSettings.worktreeTemplate`. No auto-migration; the rename is one find-and-replace in your config.

### Features

* rename block to repoSettings; add host + clone-path placeholders ([#10](https://github.com/fnrhombus/claude-code-worktree-paths/issues/10)) ([faa248b](https://github.com/fnrhombus/claude-code-worktree-paths/commit/faa248b0e29ba5e05931f1bf46b884076e11eba4))

## [0.5.0](https://github.com/fnrhombus/claude-code-worktree-paths/compare/claude-code-worktree-paths-v0.4.0...claude-code-worktree-paths-v0.5.0) (2026-05-17)


### Features

* allow / in worktree/branch names, block path escape ([#6](https://github.com/fnrhombus/claude-code-worktree-paths/issues/6)) ([618acc5](https://github.com/fnrhombus/claude-code-worktree-paths/commit/618acc5f904714b792d0c593b31947f9329b1812))

## [0.4.0](https://github.com/fnrhombus/claude-code-worktree-paths/compare/claude-code-worktree-paths-v0.3.0...claude-code-worktree-paths-v0.4.0) (2026-05-17)


### Features

* read worktreePaths from all four Claude Code settings tiers ([#7](https://github.com/fnrhombus/claude-code-worktree-paths/issues/7)) ([dfa20f9](https://github.com/fnrhombus/claude-code-worktree-paths/commit/dfa20f9f47c9fc2ac24221764ff857c84967ca58))

## [0.3.0](https://github.com/fnrhombus/claude-code-worktree-paths/compare/claude-code-worktree-paths-v0.2.0...claude-code-worktree-paths-v0.3.0) (2026-05-13)


### Features

* sanitize worktree_name input to path-safe characters ([#3](https://github.com/fnrhombus/claude-code-worktree-paths/issues/3)) ([0842f9c](https://github.com/fnrhombus/claude-code-worktree-paths/commit/0842f9c06c7245c695dd13343139bab3d34dd2f7))

## [0.2.0](https://github.com/fnrhombus/claude-code-worktree-paths/compare/claude-code-worktree-paths-v0.1.0...claude-code-worktree-paths-v0.2.0) (2026-05-13)


### Features

* implement WorktreeCreate hook with fnclaude env-var dispatch ([4afe35c](https://github.com/fnrhombus/claude-code-worktree-paths/commit/4afe35c263332d237fb87977b1a28e41fc996c05))
* settings-driven templates + release-please + branch policy ([#1](https://github.com/fnrhombus/claude-code-worktree-paths/issues/1)) ([b276134](https://github.com/fnrhombus/claude-code-worktree-paths/commit/b2761342153c0d2d784ed2c7b08f128d5c41fe71))
