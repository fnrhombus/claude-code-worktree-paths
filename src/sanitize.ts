// sanitizeForPath collapses characters that are unsafe in either filesystem
// path components or git ref names down to a single allowlist:
// [A-Za-z0-9._-]. Runs of disallowed chars become a single '-'; runs of '-'
// collapse; a leading '-' or '.' is stripped (would create a hidden dir or
// a branch name git treats as a flag); a trailing '-' is stripped.
//
// Throws if the result is empty — better to fail loudly than silently create
// a worktree at a surprising path.
export function sanitizeForPath(input: string): string {
  const cleaned = input
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-.]+|-+$/g, "");
  if (cleaned === "") {
    throw new Error(
      `worktree_name "${input}" reduces to an empty string after sanitization (allowed: [A-Za-z0-9._-])`,
    );
  }
  return cleaned;
}
