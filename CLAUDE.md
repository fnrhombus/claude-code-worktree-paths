# Claude Code Plugin Template

This is a template repo. When a new plugin is created from it (`gh repo create --template fnrhombus/claude-code-plugin-template`), this file tells Claude (and future-you) what to do.

## First-time setup for a new plugin

After cloning the new repo:

1. **Search-and-replace `TODO-plugin-name`** in `.claude-plugin/plugin.json`, `README.md`, and `package.json` with the actual plugin name (kebab-case, e.g. `claude-code-thingfix`).
2. **Search-and-replace `TODO-repo-name`** with the actual GitHub repo name (usually the same as the plugin name).
3. **Update `.claude-plugin/plugin.json`** with a real `description`.
4. **Write the actual plugin code** in `src/index.ts`. Use [`@fnrhombus/claude-code-hooks`](https://github.com/fnrhombus/claude-code-hooks) for the typed hook wrapper — it handles all the stdin/stdout/envelope plumbing.
5. **Update `hooks/hooks.json`** if the hook event or matcher is different from the default `PreToolUse` / `Bash`.
6. **Rewrite `README.md`** as *advertising* — lead with the problem, show the before/after, keep install minimal. See `fnrhombus/claude-code-pathfix` for a reference.
7. **Add the `claude-code-plugin` topic** to the repo: `gh repo edit --add-topic claude-code-plugin`. This is how `fnrhombus/claude-plugins` (the central marketplace) discovers the plugin — without this topic, the plugin will never show up in `/plugin install`.
8. **Commit + push** to `main`.

## Publishing a new version

1. Bump the `version` in both `package.json` and `.claude-plugin/plugin.json` (keep them in sync).
2. Commit, tag (`git tag v0.2.0 && git push --tags`), let CI publish to npm.
3. **Refresh the marketplace** so users see the new version within minutes instead of waiting for the daily cron:

   ```bash
   gh workflow run update-marketplace.yml --repo fnrhombus/claude-plugins
   ```

   This triggers the marketplace repo's `update-marketplace.yml` workflow manually. It will re-scan all `claude-code-plugin`-tagged repos (including this one), read the updated `plugin.json`, and commit a refreshed `marketplace.json` to itself.

   Alternatively, wait — the marketplace refreshes on a daily cron anyway. The manual trigger is only useful if you want the new version visible immediately.

## Why the indirect flow?

GitHub's `GITHUB_TOKEN` is scoped to its own repo, so this plugin's CI can't push to `fnrhombus/claude-plugins` directly. Cross-repo pushes would need a Personal Access Token stored as a secret in every plugin repo — annoying to set up once per plugin, and a long-lived credential to manage.

Instead, the marketplace *pulls* from plugin repos on a schedule using its own `GITHUB_TOKEN` (which naturally has write access to itself). Plugin repos don't need any secrets or auth; they just need the `claude-code-plugin` topic and a valid `.claude-plugin/plugin.json` on their default branch.

## What NOT to do

- **Don't hand-edit `fnrhombus/claude-plugins/.claude-plugin/marketplace.json`.** The cron overwrites it on every run. Update the source (`.claude-plugin/plugin.json` in *this* repo) and let the cron propagate.
- **Don't forget the `claude-code-plugin` topic.** Without it, the marketplace has no way to discover the repo, and users can't install the plugin.
- **Don't skip the `dist/` commit.** Plugins distributed via `/plugin install` are served directly from the GitHub repo contents — there's no build step on the user side. If this plugin has a build step (tsup, etc.), commit `dist/` alongside `src/` so the plugin hook can actually run what it advertises.
