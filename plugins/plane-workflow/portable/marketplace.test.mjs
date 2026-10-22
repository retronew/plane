import test from "node:test";
import assert from "node:assert/strict";
import { readFile, realpath, readdir } from "node:fs/promises";
import { dirname, resolve, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const json = async (path) => JSON.parse(await readFile(resolve(root, path), "utf8"));
const catalog = await json(".agents/plugins/marketplace.json");

// Assertions for the desktop compatibility manifest and marketplace.
// Marketplace fields follow https://developers.openai.com/plugins/build/plugins
// (OpenAI does not publish a marketplace schema URL on that page).
test("marketplace fields and policy match the documented OpenAI catalog format", () => {
  assert.equal(catalog.name, "plane-openai");
  assert.equal(typeof catalog.interface.displayName, "string");
  assert.equal(catalog.plugins.length, 1);
  const entry = catalog.plugins[0];
  assert.equal(entry.name, "plane-workflow");
  assert.equal(entry.source.source, "local");
  assert.ok(entry.source.path.startsWith("./"));
  assert.deepEqual(entry.policy, { installation: "AVAILABLE", authentication: "ON_INSTALL" });
  assert.equal(entry.category, "Productivity");
});

test("catalog resolves inside repository root to a self-contained desktop plugin", async () => {
  const entry = catalog.plugins[0];
  const pluginRoot = await realpath(resolve(root, entry.source.path));
  const path = relative(await realpath(root), pluginRoot);
  assert.ok(path && !path.startsWith("..") && !isAbsolute(path));
  const manifest = JSON.parse(await readFile(resolve(pluginRoot, ".codex-plugin/plugin.json"), "utf8"));
  assert.equal(manifest.skills, "./skills/");
  assert.equal(manifest.mcpServers, "./.mcp.json");
  assert.equal(manifest.name, entry.name);
  assert.match(manifest.name, /^(?!.*(?:--|\.\.))[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/);
  assert.ok(manifest.name.length <= 64);
  const allowed = new Set([
    "skills",
    "mcpServers",
    "name",
    "version",
    "description",
    "author",
    "homepage",
    "repository",
    "license",
    "keywords",
    "extensions",
  ]);
  for (const key of Object.keys(manifest)) assert.ok(allowed.has(key), `unknown manifest field: ${key}`);
  for (const key of ["version", "description", "repository"]) assert.equal(typeof manifest[key], "string");
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  assert.ok(Array.isArray(manifest.keywords));
  for (const keyword of manifest.keywords) assert.equal(typeof keyword, "string");
  assert.deepEqual((await readdir(pluginRoot)).filter((name) => name !== ".DS_Store").toSorted(), [
    ".codex-plugin",
    ".mcp.json",
    "skills",
  ]);
  assert.equal((await readdir(resolve(pluginRoot, "skills"))).length, 8);
  const claude = await json("plugins/plane-workflow/.claude-plugin/plugin.json");
  const claudeCatalog = await json(".claude-plugin/marketplace.json");
  assert.equal(manifest.version, claude.version);
  // Relative-path entries fall back to plugin.json for display fields and version,
  // so the entry must not carry its own copies that could drift.
  const claudeEntry = claudeCatalog.plugins.find((plugin) => plugin.name === entry.name);
  assert.equal(claudeEntry.source, "./plugins/plane-workflow");
  for (const key of [
    "description",
    "version",
    "displayName",
    "author",
    "homepage",
    "repository",
    "license",
    "keywords",
  ])
    assert.ok(!(key in claudeEntry), `Claude marketplace entry duplicates plugin.json field: ${key}`);
});
