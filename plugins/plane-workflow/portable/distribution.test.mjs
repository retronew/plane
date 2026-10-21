import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const source = await readFile(resolve(here, "plane-workflow/SKILL.md"));
const published = await readFile(resolve(here, "../../../apps/web/public/skills/plane-workflow/SKILL.md"));
const zip = await readFile(resolve(here, "../../../apps/web/public/skills/plane-workflow.zip"));

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

test("public copy matches the canonical portable skill byte for byte", () => {
  assert.deepEqual(published, source);
});

test("single skill metadata and portable instructions have no client-specific dependencies", () => {
  const text = source.toString("utf8");
  const frontmatter = text.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(frontmatter);
  const lines = frontmatter[1].split("\n");
  assert.equal(lines.length, 2);
  assert.equal(lines[0], "name: plane-workflow");
  assert.match(lines[1], /^description: .{20,}$/u);
  assert.doesNotMatch(
    text,
    /claude|anthropic|user_config|\$ARGUMENTS|disable-model-invocation|allowed-tools|argument-hint|\b(?:hooks?|subagents?|Task|AskUserQuestion|TodoWrite)\b|子代理|子智能体|slash|\/plane-workflow:|\/plugin|`\/mcp`|\.claude\//i
  );
  for (const workflow of ["setup", "conventions", "issue-next", "breakdown", "plan-cycle", "standup"]) {
    assert.ok(text.includes(`（${workflow}）`));
  }
  assert.match(text, /必须先.*连接 Plane MCP/);
  assert.doesNotMatch(text, /(?:目前|当前) Plane Bearer token 与 ChatGPT 的 OAuth 连接流程不兼容/);
  assert.match(text, /等待用户确认/);
  assert.match(text, /ChatGPT 没有 shell\/Git 工具/);
  assert.match(text, /Codex.*工具可用且用户授权/);
  assert.match(text, /整体替换/);
  assert.match(text, /updated_at.*不证明完成时间/);
});

test("MCP guidance distinguishes local clients from web authentication limits", async () => {
  const readme = await readFile(resolve(here, "../README.md"), "utf8");
  for (const text of [source.toString("utf8"), readme]) {
    assert.ok(text.includes("https://learn.chatgpt.com/docs/extend/mcp?surface=cli"));
    assert.match(text, /ChatGPT desktop、Codex CLI 和 IDE.*同一 Codex host.*~\/\.codex\/config\.toml/);
    assert.ok(text.includes("设置 → 插件 → 右上角添加 → 添加 MCP 服务器"));
    assert.doesNotMatch(text, /Settings → MCP servers → Add server/);
    assert.ok(text.includes("Streamable HTTP"));
    assert.match(text, /保存后点击.*Restart/);
    assert.ok(text.includes("[mcp_servers.plane]"));
    assert.ok(text.includes('url = "https://plane.example.com/mcp"'));
    assert.ok(text.includes('bearer_token_env_var = "PLANE_API_TOKEN"'));
    assert.doesNotMatch(text, /http_headers\s*=.*X-Workspace-Slug/);
    assert.ok(text.includes("export PLANE_API_TOKEN='<你的 Plane API token>'"));
    assert.ok(text.includes("$env:PLANE_API_TOKEN = '<你的 Plane API token>'"));
    assert.match(text, /图形界面启动.*host.*读取.*变量/);
    assert.match(text, /ChatGPT 网页版不读取本地/);
    assert.match(text, /只有具体入口要求 OAuth 且无法发送.*请求头时，该入口才受限/);
    assert.doesNotMatch(text, /(?:目前|当前) Plane Bearer token 与 ChatGPT 的 OAuth 连接流程不兼容/);
    assert.doesNotMatch(text, /ChatGPT 的 OAuth 连接流程与该认证方式不兼容/);
  }
});

test("Claude connection configuration contains only endpoint and credentials", async () => {
  const config = JSON.parse(await readFile(resolve(here, "../.mcp.json"), "utf8"));
  const manifest = JSON.parse(await readFile(resolve(here, "../.claude-plugin/plugin.json"), "utf8"));
  assert.deepEqual(config.mcpServers.plane.headers, { Authorization: "Bearer ${user_config.api_key}" });
  assert.deepEqual(Object.keys(manifest.userConfig).toSorted(), ["api_key", "plane_url"]);
  const skills = await Promise.all(
    ["issue-next", "issue-start", "issue-ship", "issue-breakdown", "issue-plan-cycle", "standup"].map((name) =>
      readFile(resolve(here, `../skills/${name}/SKILL.md`), "utf8")
    )
  );
  for (const skill of skills) {
    assert.ok(skill.includes('workspace(action="list")'));
    assert.match(skill, /每次调用显式传 `workspace_slug`/);
    assert.match(skill, /无权限拒绝.*不切区回退/);
  }
});

test("workspace guidance discovers targets and keeps explicit scope across calls", async () => {
  const readme = await readFile(resolve(here, "../README.md"), "utf8");
  const conventions = await readFile(resolve(here, "../skills/plane-conventions/SKILL.md"), "utf8");
  const setup = await readFile(resolve(here, "../skills/plane-setup/SKILL.md"), "utf8");
  for (const text of [source.toString("utf8"), readme, conventions, setup]) {
    assert.ok(text.includes('workspace(action="list")'));
    assert.ok(text.includes("workspace_slug"));
    assert.ok(text.includes("workspace-scoped token"));
    assert.match(text, /个人 token.*跨/);
    assert.match(text, /歧义.*询问/);
    assert.match(text, /每次.*(?:检查|校验)/);
    assert.match(text, /(?:无权限|权限限制).*(?:拒绝|停止)|拒绝.*无权限/);
    assert.match(text, /不切.*(?:其他|区)/);
  }
  for (const text of [source.toString("utf8"), readme, conventions]) {
    assert.match(text, /每次.*显式传.*workspace_slug/);
    assert.match(text, /分别调用/);
    assert.match(text, /来源/);
    assert.match(text, /(?:其他工作区操作必须显式|每次工具调用显式)/);
    assert.match(text, /写入前核实目标/);
    assert.match(text, /缺失时先 list 定位/);
  }
});

test("all concrete resource examples include explicit workspace scope except discovery", async () => {
  const names = [
    "issue-next",
    "issue-start",
    "issue-ship",
    "issue-breakdown",
    "issue-plan-cycle",
    "standup",
    "plane-conventions",
    "plane-setup",
  ];
  const texts = [source.toString("utf8"), await readFile(resolve(here, "../README.md"), "utf8")];
  texts.push(
    ...(await Promise.all(names.map((name) => readFile(resolve(here, `../skills/${name}/SKILL.md`), "utf8"))))
  );
  let examples = 0;
  for (const text of texts) {
    for (const match of text.matchAll(
      /\b(workspace|project|workitem|cycle|module|page|view|notification)\(action="([^"]+)"([^)]*)\)/g
    )) {
      examples++;
      if (match[1] === "workspace" && match[2] === "list") continue;
      assert.match(match[3], /workspace_slug=/, match[0]);
    }
    for (const match of text.matchAll(/`action="[^"]+"[^`]*`/g)) {
      assert.match(match[0], /workspace_slug=/, match[0]);
    }
  }
  assert.ok(examples > 30);
});

test("branch hint and manager resolve workspace before reading branch identifiers", async () => {
  const texts = await Promise.all(
    ["../hooks/branch-work-item.sh", "../agents/plane-manager.md"].map((path) => readFile(resolve(here, path), "utf8"))
  );
  for (const text of texts) {
    assert.match(text, /workspace\(action=/);
    assert.match(text, /workspace_slug/);
    assert.match(text, /歧义.*询问/);
    assert.match(text, /X-Workspace-Slug/);
    assert.match(text, /每次调用仍校验成员资格与项目权限/);
  }
});

test("Claude plugin ZIP has root manifest and canonical portable skill, without executable components or credentials", async () => {
  const archive = await readFile(resolve(here, "../../../apps/web/public/skills/plane-workflow-claude.zip"));
  const end = archive.length - 22;
  assert.equal(archive.readUInt32LE(end), 0x06054b50);
  assert.equal(archive.readUInt16LE(end + 4), 0);
  assert.equal(archive.readUInt16LE(end + 6), 0);
  assert.equal(archive.readUInt16LE(end + 8), 2);
  assert.equal(archive.readUInt16LE(end + 10), 2);
  assert.equal(archive.readUInt16LE(end + 20), 0);
  const centralStart = archive.readUInt32LE(end + 16);
  assert.equal(centralStart + archive.readUInt32LE(end + 12), end);
  const entries = new Map();
  let central = centralStart;
  let local = 0;
  for (let index = 0; index < 2; index++) {
    assert.equal(archive.readUInt32LE(central), 0x02014b50);
    assert.equal(archive.readUInt32LE(local), 0x04034b50);
    assert.equal(archive.readUInt32LE(central + 42), local);
    assert.equal(archive.readUInt16LE(central + 8), 0x800);
    assert.equal(archive.readUInt16LE(local + 6), 0x800);
    assert.equal(archive.readUInt16LE(central + 10), 0);
    assert.equal(archive.readUInt16LE(local + 8), 0);
    for (const position of [central + 12, local + 10]) {
      assert.equal(archive.readUInt16LE(position), 0);
      assert.equal(archive.readUInt16LE(position + 2), 33);
    }
    for (const position of [central + 30, central + 32, central + 34, local + 28]) {
      assert.equal(archive.readUInt16LE(position), 0);
    }
    assert.equal(archive.readUInt32LE(central + 38), 0);
    const nameLength = archive.readUInt16LE(central + 28);
    const size = archive.readUInt32LE(central + 24);
    assert.equal(archive.readUInt16LE(local + 26), nameLength);
    const name = archive.subarray(central + 46, central + 46 + nameLength);
    assert.deepEqual(archive.subarray(local + 30, local + 30 + nameLength), name);
    const payloadStart = local + 30 + nameLength;
    const payload = archive.subarray(payloadStart, payloadStart + size);
    for (const position of [central + 20, local + 18, local + 22]) {
      assert.equal(archive.readUInt32LE(position), size);
    }
    assert.equal(archive.readUInt32LE(central + 16), crc32(payload));
    assert.equal(archive.readUInt32LE(local + 14), crc32(payload));
    assert.ok(!entries.has(name.toString()));
    entries.set(name.toString(), payload);
    local = payloadStart + size;
    central += 46 + nameLength;
  }
  assert.equal(local, centralStart);
  assert.equal(central, end);
  assert.deepEqual([...entries.keys()], [".claude-plugin/plugin.json", "skills/plane-workflow/SKILL.md"]);
  assert.deepEqual(entries.get("skills/plane-workflow/SKILL.md"), source);
  const manifest = JSON.parse(entries.get(".claude-plugin/plugin.json").toString("utf8"));
  assert.deepEqual(
    Object.keys(manifest).toSorted(),
    [
      "name",
      "displayName",
      "version",
      "description",
      "author",
      "homepage",
      "repository",
      "license",
      "keywords",
    ].toSorted()
  );
  const codeManifest = JSON.parse(await readFile(resolve(here, "../.claude-plugin/plugin.json"), "utf8"));
  for (const key of Object.keys(manifest).filter((field) => field !== "description")) {
    assert.deepEqual(manifest[key], codeManifest[key]);
  }
  assert.equal(manifest.name, "plane-workflow");
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  assert.match(manifest.description, /独立配置.*Plane MCP/);
  assert.doesNotMatch(JSON.stringify(manifest), /user_?config|mcpServers|api_key|token|hooks|agents/i);
  assert.ok(archive.length < 200 * 1024 * 1024);
});

test("ZIP contains exactly plane-workflow/SKILL.md with matching metadata, bytes and CRC", () => {
  const end = zip.length - 22;
  assert.equal(zip.readUInt32LE(end), 0x06054b50);
  assert.equal(zip.readUInt16LE(end + 4), 0);
  assert.equal(zip.readUInt16LE(end + 6), 0);
  assert.equal(zip.readUInt16LE(end + 8), 1);
  assert.equal(zip.readUInt16LE(end + 10), 1);
  assert.equal(zip.readUInt16LE(end + 20), 0);
  const central = zip.readUInt32LE(end + 16);
  assert.equal(central + zip.readUInt32LE(end + 12), end);
  assert.equal(zip.readUInt32LE(central), 0x02014b50);
  assert.equal(zip.readUInt16LE(central + 10), 0); // stored
  assert.equal(zip.readUInt16LE(central + 8), 0x800); // UTF-8; no encryption
  assert.equal(zip.readUInt16LE(central + 30), 0); // no extra field
  assert.equal(zip.readUInt16LE(central + 32), 0); // no comment
  assert.equal(zip.readUInt16LE(central + 34), 0); // disk number
  assert.equal(zip.readUInt32LE(central + 42), 0); // local header offset
  const nameLength = zip.readUInt16LE(central + 28);
  assert.equal(central + 46 + nameLength, end);
  const name = zip.subarray(central + 46, end);
  assert.equal(name.toString(), "plane-workflow/SKILL.md");
  assert.equal(zip.readUInt32LE(0), 0x04034b50);
  assert.equal(zip.readUInt16LE(6), 0x800);
  assert.equal(zip.readUInt16LE(8), 0);
  assert.equal(zip.readUInt16LE(26), nameLength);
  assert.equal(zip.readUInt16LE(28), 0);
  assert.deepEqual(zip.subarray(30, 30 + nameLength), name);
  const payload = zip.subarray(30 + nameLength, central);
  assert.deepEqual(payload, source);
  for (const offset of [18, 22]) assert.equal(zip.readUInt32LE(offset), source.length);
  for (const offset of [20, 24]) assert.equal(zip.readUInt32LE(central + offset), source.length);
  assert.equal(zip.readUInt32LE(14), crc32(payload));
  assert.equal(zip.readUInt32LE(central + 16), crc32(payload));
});
