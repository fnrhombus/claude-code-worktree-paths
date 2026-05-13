import { describe, it } from "node:test";
import { strictEqual, throws } from "node:assert/strict";
import { sanitizeForPath } from "../src/sanitize.ts";

describe("sanitizeForPath", () => {
  it("passes through already-safe input", () => {
    strictEqual(sanitizeForPath("hello-world"), "hello-world");
    strictEqual(sanitizeForPath("Foo_Bar"), "Foo_Bar");
    strictEqual(sanitizeForPath("v1.2.3"), "v1.2.3");
    strictEqual(sanitizeForPath("abc123"), "abc123");
  });

  it("replaces forbidden characters with hyphens", () => {
    strictEqual(sanitizeForPath("foo bar"), "foo-bar");
    strictEqual(sanitizeForPath("foo/bar"), "foo-bar");
    strictEqual(sanitizeForPath("foo\\bar"), "foo-bar");
    strictEqual(sanitizeForPath("foo:bar"), "foo-bar");
    strictEqual(sanitizeForPath("foo*bar"), "foo-bar");
    strictEqual(sanitizeForPath("foo?bar"), "foo-bar");
    strictEqual(sanitizeForPath("foo|bar"), "foo-bar");
    strictEqual(sanitizeForPath("foo~bar"), "foo-bar");
    strictEqual(sanitizeForPath("foo^bar"), "foo-bar");
    strictEqual(sanitizeForPath("foo@{bar"), "foo-bar");
  });

  it("collapses runs of forbidden characters to a single hyphen", () => {
    strictEqual(sanitizeForPath("foo   bar"), "foo-bar");
    strictEqual(sanitizeForPath("foo!@#$bar"), "foo-bar");
    strictEqual(sanitizeForPath("foo//bar"), "foo-bar");
  });

  it("collapses runs of hyphens", () => {
    strictEqual(sanitizeForPath("foo---bar"), "foo-bar");
    strictEqual(sanitizeForPath("foo-/-bar"), "foo-bar");
  });

  it("strips leading hyphens and dots", () => {
    strictEqual(sanitizeForPath("-foo"), "foo");
    strictEqual(sanitizeForPath("---foo"), "foo");
    strictEqual(sanitizeForPath(".hidden"), "hidden");
    strictEqual(sanitizeForPath("..parent"), "parent");
    strictEqual(sanitizeForPath(".-.-foo"), "foo");
  });

  it("strips trailing hyphens", () => {
    strictEqual(sanitizeForPath("foo-"), "foo");
    strictEqual(sanitizeForPath("foo---"), "foo");
    strictEqual(sanitizeForPath("foo/"), "foo");
  });

  it("preserves dots in the middle", () => {
    strictEqual(sanitizeForPath("v1.2.3"), "v1.2.3");
    strictEqual(sanitizeForPath("foo.bar.baz"), "foo.bar.baz");
  });

  it("handles non-ASCII as forbidden", () => {
    strictEqual(sanitizeForPath("café"), "caf");
    strictEqual(sanitizeForPath("naïve-attempt"), "na-ve-attempt");
    // All-non-ASCII input throws (covered in the empty-result tests below).
  });

  it("throws on empty input", () => {
    throws(() => sanitizeForPath(""), /reduces to an empty string/);
  });

  it("throws when only forbidden characters", () => {
    throws(() => sanitizeForPath("???"), /reduces to an empty string/);
    throws(() => sanitizeForPath("   "), /reduces to an empty string/);
    throws(() => sanitizeForPath("---"), /reduces to an empty string/);
    throws(() => sanitizeForPath("..."), /reduces to an empty string/);
    throws(() => sanitizeForPath("日本語"), /reduces to an empty string/);
  });

  it("handles control characters", () => {
    strictEqual(sanitizeForPath("foo\x00bar"), "foo-bar");
    strictEqual(sanitizeForPath("foo\nbar"), "foo-bar");
    strictEqual(sanitizeForPath("foo\tbar"), "foo-bar");
  });
});
