import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { collectFiles } from "./files.mjs";

const here = dirname(fileURLToPath(import.meta.url));

function zipEntries(zip) {
  const entries = [];
  let offset = 0;
  while (zip.readUInt32LE(offset) === 0x04034b50) {
    assert.equal(zip.readUInt16LE(offset + 8), 0);
    const size = zip.readUInt32LE(offset + 18);
    const length = zip.readUInt16LE(offset + 26);
    const start = offset + 30 + length + zip.readUInt16LE(offset + 28);
    entries.push([zip.subarray(offset + 30, offset + 30 + length).toString(), zip.subarray(start, start + size)]);
    offset = start + size;
  }
  return entries.toSorted(([a], [b]) => a.localeCompare(b, "en"));
}

test("Claude test ZIP contains OAuth and all skills, preserves production, and validates in the client", async () => {
  const dir = await mkdtemp(resolve(tmpdir(), "plane-claude-package-"));
  const output = resolve(dir, "test-package");
  const source = resolve(here, "..");
  const original = await collectFiles(source);
  try {
    const args = [resolve(here, "local-claude-package.mjs"), output, "http://localhost:8000"];
    execFileSync(process.execPath, args);
    const plugin = resolve(output, "plane-workflow");
    assert.deepEqual((await readdir(plugin)).toSorted(), [".claude-plugin", ".mcp.json", "agents", "hooks", "skills"]);
    const config = JSON.parse(await readFile(resolve(plugin, ".mcp.json")));
    assert.deepEqual(config, { mcpServers: { plane: { type: "http", url: "http://localhost:8000/mcp" } } });
    const manifest = JSON.parse(await readFile(resolve(plugin, ".claude-plugin/plugin.json")));
    assert.equal(manifest.name, "plane-workflow");
    assert.match(manifest.version, /-local\.1$/);
    assert.deepEqual(await collectFiles(resolve(plugin, "skills")), await collectFiles(resolve(source, "skills")));
    assert.equal((await readdir(resolve(plugin, "skills"))).length, 8);
    assert.ok((await stat(resolve(plugin, "hooks/branch-work-item.sh"))).mode & 0o111);
    const archive = await readFile(resolve(output, "plane-workflow-claude-local.zip"));
    assert.deepEqual(zipEntries(archive), await collectFiles(plugin));
    execFileSync(process.execPath, [args[0], resolve(dir, "second-package"), args[2]]);
    assert.deepEqual(await readFile(resolve(dir, "second-package/plane-workflow-claude-local.zip")), archive);
    assert.deepEqual(await collectFiles(source), original);
    assert.throws(() => execFileSync(process.execPath, args, { stdio: "pipe" }));
    assert.deepEqual(await readFile(resolve(output, "plane-workflow-claude-local.zip")), archive);
    if (process.env.PLANE_TEST_CLAUDE_BIN) {
      execFileSync(process.env.PLANE_TEST_CLAUDE_BIN, ["plugin", "validate", "--strict", plugin], {
        stdio: "pipe",
        timeout: 15000,
      });
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
