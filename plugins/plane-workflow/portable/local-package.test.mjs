import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

// Opt in with the actual desktop CLI. This only reads a local package, without
// installing it, starting MCP connections or changing the client's settings.
async function readWithClient(marketplacePath) {
  const child = spawn(process.env.PLANE_TEST_CODEX_BIN, ["app-server", "--stdio"], {
    stdio: ["pipe", "pipe", "ignore"],
  });
  const lines = createInterface({ input: child.stdout });
  try {
    return await new Promise((resolveResult, reject) => {
      const timer = setTimeout(() => reject(new Error("plugin/read timed out")), 15000);
      const finish = (error, value) => {
        clearTimeout(timer);
        if (error) reject(error);
        else resolveResult(value);
      };
      const send = (id, method, params) => child.stdin.write(`${JSON.stringify({ id, method, params })}\n`);
      child.on("error", (error) => finish(error));
      child.on("exit", () => finish(new Error("app-server exited before plugin/read completed")));
      lines.on("line", (line) => {
        try {
          const message = JSON.parse(line);
          if (message.error) return finish(new Error(JSON.stringify(message.error)));
          if (message.id === 1) send(2, "plugin/read", { marketplacePath, pluginName: "plane-workflow" });
          if (message.id === 2) finish(null, message.result.plugin);
        } catch (error) {
          finish(error);
        }
      });
      send(1, "initialize", {
        clientInfo: { name: "plane_plugin_test", version: "1" },
        capabilities: { experimentalApi: true },
      });
    });
  } finally {
    lines.close();
    child.kill();
  }
}

test("local marketplace rewrites the active MCP endpoint without changing production or overwriting output", async () => {
  const dir = await mkdtemp(resolve(tmpdir(), "plane-local-package-"));
  const output = resolve(dir, "marketplace");
  const productionPath = resolve(here, "../../plane-workflow-openai/.mcp.json");
  const before = await readFile(productionPath);
  try {
    const args = [resolve(here, "local-package.mjs"), output, "http://localhost:8000"];
    execFileSync(process.execPath, args);
    const plugin = resolve(output, "plane-workflow");
    assert.deepEqual((await readdir(plugin)).toSorted(), [".codex-plugin", ".mcp.json", "skills"]);
    const manifest = JSON.parse(await readFile(resolve(plugin, ".codex-plugin/plugin.json")));
    const config = JSON.parse(await readFile(resolve(plugin, manifest.mcpServers)));
    const production = JSON.parse(before);
    production.mcpServers.plane.url = "http://localhost:8000/mcp";
    assert.deepEqual(config, production);
    assert.equal(config.mcpServers.plane.extensions["com.openai"].auth.type, "oauth");
    assert.deepEqual(await readFile(productionPath), before);
    const catalog = JSON.parse(await readFile(resolve(output, ".agents/plugins/marketplace.json")));
    assert.equal(catalog.plugins[0].name, manifest.name);
    assert.equal(resolve(output, catalog.plugins[0].source.path), plugin);
    if (process.env.PLANE_TEST_CODEX_BIN) {
      const loaded = await readWithClient(resolve(output, ".agents/plugins/marketplace.json"));
      assert.deepEqual(loaded.mcpServers, ["plane"]);
      assert.equal(loaded.skills.length, 8);
      assert.equal(loaded.summary.localVersion, manifest.version);
    }
    assert.throws(() => execFileSync(process.execPath, args, { stdio: "pipe" }));
    assert.deepEqual(JSON.parse(await readFile(resolve(plugin, manifest.mcpServers))), config);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
