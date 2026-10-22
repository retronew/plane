import { collectFiles } from "./files.mjs";
import { tmpdir } from "node:os";
/* eslint-disable no-await-in-loop -- Ordered filesystem traversal and artifact verification are intentionally sequential. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../..");
const source = resolve(here, "../skills");
const publicDir = resolve(root, "apps/web/public/skills");
async function files(dir, prefix = "") {
  const result = [];
  for (const item of (await readdir(dir, { withFileTypes: true })).toSorted((a, b) =>
    a.name.localeCompare(b.name, "en")
  )) {
    if (item.name === ".DS_Store") continue;
    if (item.isDirectory()) result.push(...(await files(resolve(dir, item.name), `${prefix}${item.name}/`)));
    else result.push([prefix + item.name, await readFile(resolve(dir, item.name))]);
  }
  return result;
}
function crc32(data) {
  // Independent table-based CRC check for the ZIP payload.
  const table = Array.from({ length: 256 }, (_, n) => {
    for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
    return n >>> 0;
  });
  let value = 0xffffffff;
  for (const byte of data) value = table[(value ^ byte) & 255] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function unzip(data) {
  const entries = new Map();
  let offset = 0;
  while (data.readUInt32LE(offset) === 0x04034b50) {
    assert.equal(data.readUInt16LE(offset + 6), 0x800);
    assert.equal(data.readUInt16LE(offset + 8), 0);
    assert.equal(data.readUInt16LE(offset + 10), 0);
    assert.equal(data.readUInt16LE(offset + 12), 33);
    const size = data.readUInt32LE(offset + 18);
    assert.equal(data.readUInt32LE(offset + 22), size);
    const length = data.readUInt16LE(offset + 26);
    const extra = data.readUInt16LE(offset + 28);
    assert.equal(extra, 0);
    const name = data.subarray(offset + 30, offset + 30 + length).toString();
    assert.ok(!entries.has(name));
    const content = data.subarray(offset + 30 + length, offset + 30 + length + size);
    assert.equal(crc32(content), data.readUInt32LE(offset + 14));
    entries.set(name, { content, offset });
    offset += 30 + length + size;
  }
  const centralStart = offset;
  const modes = new Map();
  for (const [name, entry] of entries) {
    assert.equal(data.readUInt32LE(offset), 0x02014b50);
    assert.equal(data.readUInt16LE(offset + 4) >> 8, 3);
    modes.set(name, data.readUInt32LE(offset + 38) >>> 16);
    const length = data.readUInt16LE(offset + 28);
    assert.equal(data.subarray(offset + 46, offset + 46 + length).toString(), name);
    assert.equal(data.readUInt32LE(offset + 42), entry.offset);
    assert.equal(data.readUInt32LE(offset + 16), crc32(entry.content));
    assert.equal(data.readUInt32LE(offset + 20), entry.content.length);
    assert.equal(data.readUInt32LE(offset + 24), entry.content.length);
    offset += 46 + length;
  }
  assert.equal(data.readUInt32LE(offset), 0x06054b50);
  assert.equal(data.readUInt16LE(offset + 10), entries.size);
  assert.equal(data.readUInt32LE(offset + 12), offset - centralStart);
  assert.equal(data.readUInt32LE(offset + 16), centralStart);
  assert.equal(offset + 22, data.length);
  const result = new Map([...entries].map(([name, entry]) => [name, entry.content]));
  result.modes = modes;
  return result;
}

test("all eight complete canonical skills are identical across directories and archives", async () => {
  const entries = await files(source);
  const names = entries.filter(([name]) => /^[^/]+\/SKILL\.md$/.test(name));
  assert.equal(names.length, 8);
  const generic = unzip(await readFile(resolve(publicDir, "plane-workflow.zip")));
  const claude = unzip(await readFile(resolve(publicDir, "plane-workflow-claude.zip")));
  assert.deepEqual(
    [...generic.keys()],
    entries.map(([name]) => name)
  );
  const extras = [
    ...(await files(resolve(here, "../agents"), "agents/")),
    ...(await files(resolve(here, "../hooks"), "hooks/")),
  ];
  assert.ok(extras.some(([name]) => name === "hooks/hooks.json"));
  assert.ok(extras.some(([name]) => name.startsWith("agents/")));
  assert.deepEqual(
    [...claude.keys()],
    [".claude-plugin/plugin.json", ...extras.map(([name]) => name), ...entries.map(([name]) => `skills/${name}`)]
  );
  for (const [name, content] of extras) assert.deepEqual(claude.get(name), content);
  for (const [name, mode] of [...claude.modes, ...generic.modes])
    assert.equal(mode, name.endsWith(".sh") ? 0o100755 : 0o100644, `${name}: mode`);
  assert.ok(claude.modes.has("hooks/branch-work-item.sh"));
  assert.deepEqual(await files(resolve(root, "plugins/plane-workflow-openai/skills")), entries);
  const aggregate = await readFile(resolve(publicDir, "plane-workflow/SKILL.md"), "utf8");
  for (const [name, content] of entries) {
    assert.deepEqual(generic.get(name), content);
    assert.deepEqual(claude.get(`skills/${name}`), content);
    assert.deepEqual(await readFile(resolve(publicDir, name)), content);
    if (!name.endsWith("/SKILL.md")) continue;
    const text = content.toString();
    assert.match(text, /^---\nname: [a-z-]+\ndescription: .+\n---\n/);
    assert.doesNotMatch(text, /\$ARGUMENTS|plane-workflow:|AskUserQuestion|TodoWrite|\.claude\//);
    for (const phrase of ["workspace_slug", "分页", "明确确认", "失败", "核验"])
      assert.ok(text.includes(phrase), `${name}: ${phrase}`);
    assert.ok(aggregate.includes(text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "").trim()));
  }
  const standup = (await readFile(resolve(source, "standup/SKILL.md"))).toString();
  assert.match(standup, /completed_at/);
  assert.match(standup, /updated_at.*不能作为完成时间证据/);
  for (const name of ["issue-start", "issue-ship"])
    assert.match((await readFile(resolve(source, name, "SKILL.md"))).toString(), /工具.*可用/);
  const claudeManifest = JSON.parse(await readFile(resolve(here, "../.claude-plugin/plugin.json")));
  assert.deepEqual(JSON.parse(claude.get(".claude-plugin/plugin.json")), claudeManifest);
  const openaiManifest = JSON.parse(await readFile(resolve(root, "plugins/plane-workflow-openai/plugin.json")));
  assert.deepEqual(openaiManifest, {
    $schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
    ...Object.fromEntries(
      ["name", "version", "description", "author", "homepage", "repository", "license", "keywords"].map((key) => [
        key,
        claudeManifest[key],
      ])
    ),
  });
});

test("distributions contain no embedded credentials or unsupported installation prompts", async () => {
  for (const dir of [resolve(here, ".."), resolve(root, "plugins/plane-workflow-openai"), publicDir]) {
    for (const [name, content] of await files(dir)) {
      assert.doesNotMatch(name, /(?:^|\/)(?:\.env|\.DS_Store)$/);
      if (name.endsWith(".json")) assert.doesNotMatch(content.toString(), /"(?:userConfig|mcp_servers|connectors)"/);
      if (!name.endsWith(".zip"))
        assert.doesNotMatch(content.toString(), /(?:sk_live_|sk-proj-|ghp_)[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9_-]{32,}/);
    }
  }
});

test("rebuilding produces identical complete artifacts", async () => {
  const openaiDir = resolve(root, "plugins/plane-workflow-openai");
  const before = [await files(publicDir), await files(openaiDir)];
  execFileSync(process.execPath, [resolve(here, "build.mjs")], { cwd: root });
  assert.deepEqual([await files(publicDir), await files(openaiDir)], before);
});

test("nested scripts, references and assets survive traversal while Finder files are ignored", async () => {
  const dir = await mkdtemp(resolve(tmpdir(), "plane-skill-fixture-"));
  try {
    const expected = [];
    for (const name of [
      "example/SKILL.md",
      "example/scripts/nested/tool.js",
      "example/references/nested/guide.txt",
      "example/assets/nested/icon.bin",
    ]) {
      const content = Buffer.from([0, 1, 2, 255]);
      await mkdir(dirname(resolve(dir, name)), { recursive: true });
      await writeFile(resolve(dir, name), content);
      expected.push([name, content]);
    }
    await writeFile(resolve(dir, ".DS_Store"), "ignore");
    await writeFile(resolve(dir, "example/assets/.DS_Store"), "ignore");
    assert.deepEqual(
      await collectFiles(dir),
      expected.toSorted(([a], [b]) => a.localeCompare(b, "en"))
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("OpenAI archive carries the same OAuth endpoint and full skills as the installed plugin", async () => {
  const pluginRoot = resolve(root, "plugins/plane-workflow-openai");
  const archive = unzip(await readFile(resolve(publicDir, "plane-workflow-openai.zip")));
  const expected = await files(pluginRoot);
  assert.equal(archive.size, expected.length);
  for (const [name, content] of expected) assert.deepEqual(archive.get(name), content);
  const config = JSON.parse(archive.get("mcp.json"));
  assert.equal(config.mcpServers.plane.url, "https://plane.mdropwork.com/mcp");
  assert.equal(config.mcpServers.plane.extensions["com.openai"].auth.type, "oauth");
  assert.ok(!("headers" in config.mcpServers.plane));
});
