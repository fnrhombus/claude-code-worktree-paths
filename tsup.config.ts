import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  // CJS-only: this is a bin script, dual-publish doesn't buy anything.
  format: ["cjs"],
  target: "node20",
  clean: true,
  sourcemap: false,
  dts: false,
  // Bundle everything — this is a bin script, not a library. One
  // self-contained dist/index.js means faster install and no runtime dep
  // graph for users.
  noExternal: [/.*/],
  // Parsing smaller code is a real startup win for a per-command hook.
  minify: true,
  // Keep the shebang in src/index.ts as-is on the first line of
  // dist/index.js — tsup preserves it automatically.
});
