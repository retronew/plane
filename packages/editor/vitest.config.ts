import { defineConfig } from "vitest/config";
export default defineConfig({
  resolve: { tsconfigPaths: true, dedupe: ["react", "react-dom"] },
  test: {
    include: ["tests/**/*.test.tsx", "src/plate/**/*.test.{ts,tsx}", "src/plate-headless/**/*.test.ts"],
    environment: "jsdom",
  },
});
