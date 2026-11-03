import { build } from "vite";
import type { Rollup } from "vite";
import { expect, it } from "vitest";
import { buildVersionPlugin } from "./build-version-plugin";

it("ships the same identifier in the client bundle and version endpoint", async () => {
  const buildId = "test-build-123";
  const result = (await build({
    configFile: false,
    logLevel: "silent",
    plugins: [
      {
        name: "test-entry",
        resolveId: (id) => (id === "virtual:entry" ? id : undefined),
        load: (id) => (id === "virtual:entry" ? "globalThis.buildId = __PLANE_WEB_BUILD_ID__;" : undefined),
      },
      buildVersionPlugin(buildId),
    ],
    define: { __PLANE_WEB_BUILD_ID__: JSON.stringify(buildId) },
    build: { write: false, rollupOptions: { input: "virtual:entry" } },
  })) as Rollup.RollupOutput;
  const version = result.output.find((file) => file.type === "asset" && file.fileName === "version.json");
  expect(version?.type === "asset" && JSON.parse(String(version.source))).toEqual({ buildId });
  expect(result.output.some((file) => file.type === "chunk" && file.code.includes(buildId))).toBe(true);
});
