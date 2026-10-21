import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(here, "../../../apps/web/public/skills");
const data = await readFile(resolve(here, "plane-workflow/SKILL.md"));

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

// Deliberate metadata allowlist: never copy the Code plugin's userConfig or MCP configuration.
const codeManifest = JSON.parse(await readFile(resolve(here, "../.claude-plugin/plugin.json"), "utf8"));
const manifest = Buffer.from(
  `${JSON.stringify(
    {
      name: codeManifest.name,
      displayName: codeManifest.displayName,
      version: codeManifest.version,
      description: "通过独立配置的 Plane MCP 查询待办、拆解需求、规划周期、汇总站会并遵循团队规范。",
      author: codeManifest.author,
      homepage: codeManifest.homepage,
      repository: codeManifest.repository,
      license: codeManifest.license,
      keywords: codeManifest.keywords,
    },
    null,
    2
  )}\n`
);
const openaiSkillDir = resolve(here, "../../plane-workflow-openai/skills/plane-workflow");
await mkdir(openaiSkillDir, { recursive: true });
await writeFile(resolve(openaiSkillDir, "SKILL.md"), data);
await mkdir(resolve(publicDir, "plane-workflow"), { recursive: true });
await writeFile(resolve(publicDir, "plane-workflow/SKILL.md"), data);
await writeFile(resolve(publicDir, "plane-workflow.zip"), createZip([["plane-workflow/SKILL.md", data]]));
await writeFile(
  resolve(publicDir, "plane-workflow-claude.zip"),
  createZip([
    [".claude-plugin/plugin.json", manifest],
    ["skills/plane-workflow/SKILL.md", data],
  ])
);
console.log("Generated public skill, plane-workflow.zip and plane-workflow-claude.zip");
