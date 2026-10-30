import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/lib.ts", "src/plate.ts", "src/plate-headless.ts"],
  format: ["esm"],
  dts: true,
  copy: ["src/styles"],
  exports: {
    customExports: (exports) => ({
      ...exports,
      "./plate.css": "./dist/plate.css",
      "./styles.css": "./dist/styles/index.css",
      "./styles": "./dist/styles/index.css",
    }),
  },
  platform: "neutral",
});
