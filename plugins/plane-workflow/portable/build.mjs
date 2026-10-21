import { collectFiles } from "./files.mjs";
/* eslint-disable no-await-in-loop -- Ordered filesystem traversal and artifact verification are intentionally sequential. */
import { readFile, mkdir, writeFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(here, "../../../apps/web/public/skills");
const sourceDir = resolve(here, "../skills");

function createZip(entries) {
  // Stored entries, UTF-8 filenames, fixed DOS date (1980-01-01).
  // No dependencies, host timestamps, directory entries, or platform attributes.
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
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x800, 8);
    central.writeUInt16LE(33, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(content.length, 20);
    central.writeUInt32LE(content.length, 24);
    central.writeUInt16LE(name.length, 28);
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

本文件由 build.mjs 生成，请勿手工编辑。兼容下载索引；主安装目录是 plugins/plane-workflow/skills。安装不代表 MCP 已配置，需用户手动配置 URL 与令牌。

${names.map((name) => `- ${name}：见下文完整流程`).join("\n")}

${names
  .map((name) =>
    entries
      .find(([path]) => path === `${name}/SKILL.md`)[1]
      .toString()
      .replace(/^---\n[\s\S]*?\n---\n/, "")
      .trim()
  )
  .join("\n\n---\n\n")}\n`);
for (const dir of [resolve(publicDir, "plane-workflow"), portableDir]) {
  await mkdir(dir, { recursive: true });
  await writeFile(resolve(dir, "SKILL.md"), aggregate);
}
await writeFile(resolve(publicDir, "plane-workflow.zip"), createZip(entries));
await writeFile(
  resolve(publicDir, "plane-workflow-claude.zip"),
  createZip([
    [".claude-plugin/plugin.json", manifest],
    ...entries.map(([name, content]) => [`skills/${name}`, content]),
  ])
);
console.log("Generated eight skills, compatibility index, and reproducible archives");
