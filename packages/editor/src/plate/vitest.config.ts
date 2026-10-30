import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["src/plate/**/*.test.tsx"], environment: "jsdom" } });
