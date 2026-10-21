import test from "node:test";
import assert from "node:assert/strict";
import { readFile, realpath, readdir } from "node:fs/promises";
import { dirname, resolve, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const json = async (path) => JSON.parse(await readFile(resolve(root, path), "utf8"));
const catalog = await json(".agents/plugins/marketplace.json");

// Basic assertions for the fields we use from Agent Plugins 1.0.0:
// https://agent-plugins.org/schemas/1.0.0/plugin.schema.json
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

test("catalog resolves inside repository root to a self-contained portable plugin", async () => {
  const entry = catalog.plugins[0];
  const pluginRoot = await realpath(resolve(root, entry.source.path));
  const path = relative(await realpath(root), pluginRoot);
  assert.ok(path && !path.startsWith("..") && !isAbsolute(path));
  const manifest = JSON.parse(await readFile(resolve(pluginRoot, "plugin.json"), "utf8"));
  assert.equal(manifest.$schema, "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json");
  assert.equal(manifest.name, entry.name);
  assert.match(manifest.name, /^(?!.*(?:--|\.\.))[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/);
  assert.ok(manifest.name.length <= 64);
  const allowed = new Set([
    "$schema",
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
  assert.deepEqual((await readdir(pluginRoot)).toSorted(), ["plugin.json", "skills"]);
  assert.deepEqual(await readdir(resolve(pluginRoot, "skills")), ["plane-workflow"]);
  assert.deepEqual(
    await readFile(resolve(pluginRoot, "skills/plane-workflow/SKILL.md")),
    await readFile(resolve(root, "plugins/plane-workflow/portable/plane-workflow/SKILL.md"))
  );
});
