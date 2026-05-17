// sanitizeForPath collapses characters that are unsafe in either filesystem
// path components or git ref names down to a single allowlist:
// [A-Za-z0-9._/-]. Runs of disallowed chars become a single '-'; runs of '-'
// or '/' each collapse to one; a leading '-' or '.' is stripped (would create
// a hidden dir or a branch name git treats as a flag); trailing '-' or '/'
// are stripped.
//
// `/` is allowed so nested git refs (`feat/foo`, `team/x/y/z`) pass through
// untouched and produce nested worktree paths. Two extra guards keep the
// result safe against path escapes:
//
// - A leading `/` is rejected — it would escape any configured path prefix.
// - A `..` substring is rejected — matches git's ref-format rule and also
//   catches `foo/../bar` style escapes.
//
// Throws if the result is empty — better to fail loudly than silently create
// a worktree at a surprising path.
export function sanitizeForPath(input: string): string {
  if (input === "") {
    throw new Error(
      `worktree_name "${input}" reduces to an empty string after sanitization (allowed: [A-Za-z0-9._/-])`,
    );
  }
  if (input.startsWith("/")) {
    throw new Error(
      `worktree_name "${input}" has a leading '/' (absolute-path escape); strip it before passing`,
    );
  }
  const cleaned = input
    .replace(/[^A-Za-z0-9._/-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/\/{2,}/g, "/")
    .replace(/^[-.]+|[-/]+$/g, "");
  if (cleaned === "") {
    throw new Error(
      `worktree_name "${input}" reduces to an empty string after sanitization (allowed: [A-Za-z0-9._/-])`,
    );
  }
  if (cleaned.includes("..")) {
    throw new Error(
      `worktree_name "${input}" contains '..' after sanitization (path-escape / git ref-format violation)`,
    );
  }
  return cleaned;
}
