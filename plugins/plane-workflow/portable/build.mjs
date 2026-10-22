import { mcpConfig } from "./mcp-config.mjs";
import { collectFiles } from "./files.mjs";
/* eslint-disable no-await-in-loop -- Ordered filesystem traversal and artifact verification are intentionally sequential. */
import { readFile, mkdir, writeFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(here, "../../../apps/web/public/skills");
const sourceDir = resolve(here, "../skills");

export function createZip(entries) {
  // Stored entries, UTF-8 filenames, fixed DOS date (1980-01-01).
  // No dependencies, host timestamps or directory entries. Unix modes are fixed
  // (755 for .sh, 644 otherwise) so hook scripts stay executable after extraction.
  const files = [];
  const directory = [];
  let offset = 0;
  for (const [path, content] of entries) {
    const name = Buffer.from(path);
    let crc = 0xffffffff;
    for (const byte of content) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x800, 6);
    local.writeUInt16LE(33, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(content.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50);
    central.writeUInt16LE((3 << 8) | 20, 4); // Made by Unix, so external attributes carry the mode.
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x800, 8);
    central.writeUInt16LE(33, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(content.length, 20);
    central.writeUInt32LE(content.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE((path.endsWith(".sh") ? 0o100755 : 0o100644) * 0x10000, 38);
    central.writeUInt32LE(offset, 42);
    files.push(local, name, content);
    directory.push(central, name);
    offset += local.length + name.length + content.length;
  }
  const centralData = Buffer.concat(directory);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralData.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...files, centralData, end]);
}

// All generated destinations below are owned exclusively by this builder.
const codeManifest = JSON.parse(await readFile(resolve(here, "../.claude-plugin/plugin.json"), "utf8"));
const manifest = Buffer.from(`${JSON.stringify(codeManifest, null, 2)}\n`);
const compatibilityManifest = {
  ...codeManifest,
  skills: "./skills/",
  mcpServers: "./.mcp.json",
};
// Claude-only components shipped in the Claude upload package alongside the skills.
const claudeExtras = [
  ...(await collectFiles(resolve(here, "../agents"), "agents/")),
  ...(await collectFiles(resolve(here, "../hooks"), "hooks/")),
];
const entries = await collectFiles(sourceDir);
const names = entries.filter(([name]) => /^[^/]+\/SKILL\.md$/.test(name)).map(([name]) => name.split("/")[0]);
if (names.length !== 8) throw new Error("Expected eight canonical skills");
const openaiDir = resolve(here, "../../plane-workflow-openai/skills");
const portableDir = resolve(here, "plane-workflow");
for (const dir of [publicDir, openaiDir, portableDir]) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
}
for (const [name, content] of entries) {
  for (const dir of [publicDir, openaiDir]) {
    await mkdir(dirname(resolve(dir, name)), { recursive: true });
    await writeFile(resolve(dir, name), content);
  }
}
const aggregate = Buffer.from(`---
name: plane-workflow
description: 完整八项 Plane 工作流的兼容聚合索引，包含连接检查、团队规范、待办、开工、提交、拆需求、周期规划与站会
---

# Plane Workflow：完整八项技能

本文件由 build.mjs 生成，请勿手工编辑。兼容下载索引；主安装目录是 plugins/plane-workflow/skills。OpenAI 插件绑定实例地址，安装后需连接并登录授权；其他客户端也可手动配置 URL 与 API 令牌。

${names.map((name) => `- ${name}：见下文完整流程`).join("\n")}

${names
  .map((name) =>
    entries
      .find(([path]) => path === `${name}/SKILL.md`)[1]
      .toString()
      .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "")
      .trim()
  )
  .join("\n\n---\n\n")}\n`);
for (const dir of [resolve(publicDir, "plane-workflow"), portableDir]) {
  await mkdir(dir, { recursive: true });
  await writeFile(resolve(dir, "SKILL.md"), aggregate);
}
// Root portable manifests shadow the compatibility manifest in current desktop clients.
// Remove stale generated files when upgrading an existing checkout.
for (const name of ["plugin.json", "mcp.json"]) {
  await rm(resolve(here, "../../plane-workflow-openai", name), { force: true });
}
await writeFile(resolve(publicDir, "plane-workflow.zip"), createZip(entries));
await writeFile(
  resolve(publicDir, "plane-workflow-claude.zip"),
  createZip([
    [".claude-plugin/plugin.json", manifest],
    ...claudeExtras,
    ...entries.map(([name, content]) => [`skills/${name}`, content]),
  ])
);
console.log("Generated eight skills, compatibility index, and reproducible archives");

const instance = JSON.parse(await readFile(resolve(here, "../instance.json"), "utf8"));
const compatibilityEntries = [
  [".codex-plugin/plugin.json", Buffer.from(`${JSON.stringify(compatibilityManifest, null, 2)}\n`)],
  [".mcp.json", Buffer.from(`${JSON.stringify(mcpConfig(instance.url), null, 2)}\n`)],
];
for (const [name, content] of compatibilityEntries) {
  const path = resolve(here, "../../plane-workflow-openai", name);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}
await writeFile(
  resolve(publicDir, "plane-workflow-openai.zip"),
  createZip([...compatibilityEntries, ...entries.map(([name, content]) => [`skills/${name}`, content])])
);
