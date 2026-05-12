# claude-code-worktree-paths

Claude Code plugin: customize where `--worktree` worktrees go and what branch they get, via templates in `~/.claude/settings.json`. See `README.md` for the user-facing docs.

## Branch policy

**Never commit to `main`.** Main is protected on GitHub — direct pushes are rejected. All work, including one-line fixes, goes through:

1. Create a feature branch (`git checkout -b feat/whatever`)
2. Commit there with conventional-commit messages (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, etc.)
3. Push the branch, open a PR
4. Merge the PR

The branch protection enforces this — you can't bypass it locally even if you forget.

## Release policy

Versioning is automated by [release-please](https://github.com/googleapis/release-please). **Don't bump versions manually.**

Triggers:
- `feat:` → minor bump (0.x → 0.(x+1).0)
- `fix:` → patch bump
- `feat!:` or `BREAKING CHANGE:` in body → major bump
- `chore:`, `docs:`, `refactor:`, `style:`, `test:` → no bump (still good to use, just doesn't release)

After a normal PR merges to `main`, the release-please workflow opens (or updates) a `chore(main): release X.Y.Z` PR with the version bump and changelog. **Merge that PR** to release: it tags the commit, creates the GitHub release, and the marketplace cron picks it up.

`package.json` and `.claude-plugin/plugin.json` versions are kept in sync automatically via release-please's `extra-files` config — no manual sync.

## After a release

The marketplace at `fnrhombus/claude-plugins` discovers new versions on its daily cron. To force-refresh immediately:

```bash
gh workflow run update-marketplace.yml --repo fnrhombus/claude-plugins
```

## Building

`dist/index.js` is committed to the repo because plugins distributed via `/plugin install` are served directly from GitHub repo contents — no build step runs on the user side. **Whenever `src/` changes, run `npm run build` and commit `dist/` in the same PR.**

```bash
npm run typecheck   # tsc --noEmit, strict
npm run build       # tsup, bundles to dist/index.js
```

The build is intentionally tiny (~3 KB, single CJS file) — the plugin is on the synchronous path between user keystroke and worktree creation, and every saved millisecond is felt. Don't add the `@fnrhombus/claude-code-hooks` runtime back unless you have a reason; the inline stdin/JSON protocol in `src/index.ts` is faster.

## What NOT to do

- **Don't bump version manually** — release-please owns it.
- **Don't commit to `main` directly** — branch protection blocks it.
- **Don't skip the `dist/` commit.** No CI rebuilds for users; the file in the repo is what runs.
- **Don't hand-edit `fnrhombus/claude-plugins/marketplace.json`** — the cron overwrites it. Update this repo and propagation happens.
- **Don't remove the `claude-code-plugin` topic** on the GitHub repo — without it, the marketplace can't discover the plugin.
