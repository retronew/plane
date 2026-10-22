// Build a standalone Claude OAuth test plugin; production files are never changed.
/* eslint-disable no-await-in-loop -- Preserve deterministic package order. */
import { mkdir, readFile, writeFile, chmod } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { collectFiles } from "./files.mjs";
import { mcpConfig } from "./mcp-config.mjs";
import { createZip } from "./zip.mjs";
import { checkDesktopEndpoint } from "./claude-desktop.mjs";

const [destination, origin, mode] = process.argv.slice(2);
if (!destination || !origin || (mode && mode !== "--desktop"))
  throw new Error("Usage: node local-claude-package.mjs <new-output-directory> <test-origin> [--desktop]");
if (mode === "--desktop") await checkDesktopEndpoint(origin);
const config = mcpConfig(origin, { allowLocal: true });
const source = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(await readFile(resolve(source, ".claude-plugin/plugin.json"), "utf8"));
manifest.version = `${manifest.version.split("-")[0]}-local.2`;
manifest.description = "Plane OAuth 本地测试插件：八项技能与实例绑定的 MCP 连接。";
const desktopGuide = `# Plane Workflow 测试连接

服务地址：${config.mcpServers.plane.url}

## Claude 桌面端 Code 模式

安装 ZIP 后不会自动打开授权页。先打开本机 Code 会话，在右侧 Connectors 中点击 Manage connectors，等待 MCP servers 列表加载 plane，再点击 Connect。若会话尚未启动，先发送一句不调用工具、不修改文件的普通消息。安装前已运行的会话可能未加载插件，必要时另开本机 Code 会话。

插件详情的 Connect 按钮依赖一个已加载此 MCP 的 Code 会话；按钮灰色时，先完成上述会话初始化。

桌面端授权页必须使用 HTTPS，即使服务在本机。HTTP localhost 包可用于终端 Claude Code，但桌面端会报 must be https。仅把插件 URL 改成 HTTPS 不够：OAuth issuer、resource、发现端点和登录/授权前端也必须匹配测试入口，证书必须受客户端信任。不要关闭 TLS 验证。

${new URL(origin).protocol === "https:" ? "此包使用 HTTPS；首次连接请核对 Plane 账号，先授予只读权限。" : "此包使用 HTTP，只用于终端 Claude Code；不要用它验收桌面端 OAuth。"}

## Claude Chat / Cowork 的远程连接

远程连接通过 Anthropic 云端访问，localhost 和本机专用域名不可达。请使用可从云端访问的 HTTPS 测试实例，不要与本机 Code 模式混淆。
`;
const entries = [
  [".claude-plugin/plugin.json", Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`)],
  [".mcp.json", Buffer.from(`${JSON.stringify(config, null, 2)}\n`)],
  ["README.md", Buffer.from(desktopGuide)],
  ...(await collectFiles(resolve(source, "agents"), "agents/")),
  ...(await collectFiles(resolve(source, "hooks"), "hooks/")),
  ...(await collectFiles(resolve(source, "skills"), "skills/")),
];
const output = resolve(destination);
await mkdir(output); // Fail if it exists; never overwrite a user's package or checkout.
for (const [name, content] of entries) {
  const target = resolve(output, "plane-workflow", name);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content);
  if (name.endsWith(".sh")) await chmod(target, 0o755);
}
await writeFile(resolve(output, "plane-workflow-claude-local.zip"), createZip(entries));
await writeFile(
  resolve(output, "测试说明.md"),
  `${desktopGuide}

# Claude OAuth 本地测试

连接地址：\`${config.mcpServers.plane.url}\`。插件版本：\`${manifest.version}\`。
这是测试包，含八项技能、Claude agents/hooks 和根目录 .mcp.json；不包含任何令牌或登录信息。正式 Claude 分发包的配置没有改变。

## Claude Code

保持测试后端和前端运行。使用支持 --plugin-dir 的 Claude Code，在你信任的本地项目目录运行：

\`\`\`sh
claude --plugin-dir "${resolve(output, "plane-workflow-claude-local.zip")}"
\`\`\`

如果客户端不支持直接加载 ZIP，请解压到新目录，再将 --plugin-dir 指向该目录。不要覆盖现有插件目录，也不要同时加载同名正式插件。若已手动添加相同 URL 的 MCP，Claude 可能优先使用手动配置；先在 /mcp 确认连接来自本测试插件。

1. 在 /mcp 找到 plugin:plane-workflow:plane，选择认证。浏览器打开 Plane，核对账号、范围与有效期（本地默认 180 天），先保持只读并同意。
2. 回到 Claude，仅让它列出工作区并检查身份。可以使用提示词：“检查 Plane 连接，只读列出工作区，不创建或修改任何内容。”后续读取显式指定 workspace_slug。
3. 到 Plane 的个人设置 → 开发者 → 授权连接，撤销刚建立的 Claude 连接（不要撤销其他客户端）。再次调用应提示认证失效。
4. 回到 Claude 的 /mcp，重新认证该服务；重新授权后只读调用应恢复。已有其他客户端连接应仍然可用。
5. 访问令牌最多 1 小时，可自动刷新；刷新不会延长总授权。总授权到期后需要重新认证。不要为测试修改系统时间或真实授权数据。

## Claude Desktop / Cowork

桌面端 Code 模式请按本文开头的步骤连接。Chat / Cowork 的远程连接需要云端可达的 HTTPS 地址；普通聊天附件不等于安装插件。本机专用域名同样不能用于云端连接。

测试完成后可退出通过 --plugin-dir 启动的会话，并在 Plane 撤销本次 Claude 测试授权。无需卸载或改动其他插件。
`
);
console.log(`Claude OAuth test package: ${resolve(output, "plane-workflow-claude-local.zip")}`);
