// Build a standalone Claude OAuth test plugin; production files are never changed.
/* eslint-disable no-await-in-loop -- Preserve deterministic package order. */
import { mkdir, readFile, writeFile, chmod } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { collectFiles } from "./files.mjs";
import { mcpConfig } from "./mcp-config.mjs";
import { createZip } from "./zip.mjs";

const [destination, origin] = process.argv.slice(2);
if (!destination || !origin)
  throw new Error("Usage: node local-claude-package.mjs <new-output-directory> <test-origin>");
const config = mcpConfig(origin, { allowLocal: true });
const source = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(await readFile(resolve(source, ".claude-plugin/plugin.json"), "utf8"));
manifest.version = `${manifest.version.split("-")[0]}-local.1`;
manifest.description = "Plane OAuth 本地测试插件：八项技能与实例绑定的 MCP 连接。";
const entries = [
  [".claude-plugin/plugin.json", Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`)],
  [".mcp.json", Buffer.from(`${JSON.stringify(config, null, 2)}\n`)],
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
  `# Claude OAuth 本地测试

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

仅在客户端明确提供插件 ZIP 导入入口时导入此包；普通聊天附件不等于安装。此包绑定的是本机测试地址，如果该界面的 MCP 连接由云端或隔离虚拟机发起，它无法访问宿主机 localhost。遇到这种情况，请先用本机 Claude Code 测试；不要将此结果误判为 OAuth 失败。需要远程测试时，应另用可达 HTTPS 测试实例重新生成包。

测试完成后可退出通过 --plugin-dir 启动的会话，并在 Plane 撤销本次 Claude 测试授权。无需卸载或改动其他插件。
`
);
console.log(`Claude OAuth test package: ${resolve(output, "plane-workflow-claude-local.zip")}`);
