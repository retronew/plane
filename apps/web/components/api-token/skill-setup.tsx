import { useSyncExternalStore } from "react";
import { useTranslation } from "@plane/i18n";
import { ApiTokenCopyButton } from "./copy-feedback";
import { McpCodePreview } from "./mcp-code-preview";

const subscribe = () => () => {};
const getOrigin = () => window.location.origin;
const getServerOrigin = () => "";
const marketplaceCommand =
  "codex plugin marketplace add retronew/plane --ref preview\ncodex plugin add plane-workflow@plane-openai\ncodex plugin list --marketplace plane-openai";
const claudeInstallCommand =
  "claude plugin marketplace add retronew/plane\nclaude plugin install plane-workflow@plane-ai";
const skillInstallCommand =
  "npx skills add https://github.com/retronew/plane/tree/preview/plugins/plane-workflow/skills";

export type SkillClient = "claude" | "desktop" | "chatgpt" | "codex" | "generic";

function buildPortableInstallPrompt(origin: string) {
  return `先检查 shell、Node.js/npx 和客户端技能加载能力。运行 ${skillInstallCommand} --list，确认 preview 源可发现全部 8 个 skills；--list 只发现技能，不会安装。确认后运行 ${skillInstallCommand}，安装全部 8 个 skills，让用户选择目标客户端和项目级或全局安装范围；没有明确授权，不默认添加 --global、--agent 或 --yes。运行 npx skills list（全局安装使用 npx skills list --global），再检查当前客户端是否实际加载全部 8 个 skills，按需重新加载。缺少安装能力时，提供 ${origin}/skills/plane-workflow.zip，解压后按客户端支持的方式逐个上传或安装其中 8 个技能目录；普通聊天附件不算安装。不支持技能时明确说明限制，不声称已安装。`;
}

export function buildSkillAgentPrompt(client: SkillClient, origin: string) {
  const portable = buildPortableInstallPrompt(origin);
  const setup =
    client === "generic"
      ? portable
      : client === "claude"
        ? `检查 Claude Code 插件支持和已有安装，再运行：\n${claudeInstallCommand}\n核对插件安装及全部 8 个 skills 的实际加载。安装后引导用户进入 Plane「MCP」菜单手动连接。`
        : client === "desktop"
          ? `在 Claude Desktop 打开 Customize → Plugins → Add → Add marketplace → Add from a repository，添加 https://github.com/retronew/plane，然后从 plane-ai 安装 plane-workflow。先检查已有安装，避免重复；不用 Claude Code CLI 代替桌面安装。没有界面工具时提供人工步骤。备用插件包：${origin}/skills/plane-workflow-claude.zip，在 Customize → Plugins 上传。也可下载 ${origin}/skills/plane-workflow.zip，解压后按客户端支持的方式逐个上传或安装全部 8 个 skills，不假设支持一次上传多技能 ZIP；两种包都不包含 MCP。普通聊天附件不算安装。`
          : `只通过官方 Codex CLI 安装，不尝试 ChatGPT 或 Codex desktop UI 自动化。先在 PATH 或宿主明确提供的位置检测官方 codex 可执行文件；不搜索其他路径或凭据。缺少 CLI 时明确停止，并给出以下命令供用户在目标客户端同一 host 手动执行，不声称已安装。CLI 可用时检查 codex plugin add --help 和已有安装，再依次运行：\n${marketplaceCommand}\n市场注册不等于插件已安装。核对 plane-workflow 安装结果，并在同一 host 的目标客户端重新加载，实际验证全部 8 个 skills 已加载；无法验证时明确标记未验证。不能承诺 ChatGPT 云端、网页或其他 host 同步。CLI 不支持插件时提供八技能备用安装方案：${portable}`;
  return `请为当前客户端安装 Plane Workflow 的全部 8 个 skills。所有渠道共用 canonical 源 plugins/plane-workflow/skills。\n\n${setup}\n\n保留已有插件、技能和配置，遇到覆盖先比较并征求确认。技能安装不等于 MCP 连接；插件和技能包没有内置 MCP 或凭据表单。MCP 由用户独立手动配置：引导用户进入 Plane「MCP」菜单获取 URL 和个人访问令牌，并在客户端安全入口提供；不使用 OAuth，不读取、搜集或回显凭据。\n\n分别报告安装、实际加载和 MCP 连通结果；未配置 MCP 时标记待用户手动连接。已有 MCP 工具时先调用 workspace(action="list") 只读列出可访问工作区；仅继承用户已明确的目标 workspace_slug，目标不明确时先询问。后续项目等工作区查询必须显式传入该 workspace_slug，不使用默认工作区或回退目标，不创建数据。`;
}

export function ApiTokenSkillSetup() {
  const { t } = useTranslation();
  const origin = useSyncExternalStore(subscribe, getOrigin, getServerOrigin);
  const clients: { id: SkillClient; name: string; logo: string }[] = [
    { id: "chatgpt", name: "ChatGPT", logo: "openai.svg" },
    { id: "desktop", name: "Claude Desktop", logo: "claude-color.svg" },
    { id: "claude", name: "Claude Code", logo: "claudecode-color.svg" },
    { id: "codex", name: "Codex", logo: "codex-color.svg" },
    { id: "generic", name: t("account_settings.skills.generic_title"), logo: "mcp.svg" },
  ];
  return (
    <div className="mt-5 space-y-4 [&_button]:text-12">
      <p className="text-13 text-secondary">{t("account_settings.skills.connection_hint")}</p>
      <div className="divide-y divide-subtle overflow-hidden rounded-lg border border-subtle">
        {clients.map((client) => (
          <div key={client.id} className="space-y-3 bg-surface-1 p-3">
            <div className="flex flex-wrap items-center gap-3">
              <img
                src={`/logos/mcp-clients/${client.logo}`}
                alt=""
                className={`size-4 object-contain ${client.id === "chatgpt" || client.id === "generic" ? "dark:invert" : ""}`}
              />
              <span className="min-w-0 flex-1 text-13 font-medium">{client.name}</span>
              <ApiTokenCopyButton
                value={buildSkillAgentPrompt(client.id, origin)}
                label={t("account_settings.mcp.agent_prompt")}
                ariaLabel={t("account_settings.skills.agent_prompt_label", { name: client.name })}
              />
            </div>
            {client.id === "desktop" || client.id === "chatgpt" || client.id === "generic" ? (
              <ol className="list-decimal space-y-2 pl-5 text-12 text-secondary">
                {([1, 2, 3, 4] as const).map((step) => (
                  <li key={step}>{t(`account_settings.skills.${client.id}_step_${step}`)}</li>
                ))}
              </ol>
            ) : (
              <>
                <p className="text-12 text-secondary">
                  {t(
                    client.id === "claude"
                      ? "account_settings.skills.claude_hint"
                      : "account_settings.skills.openai_hint"
                  )}
                </p>
                <McpCodePreview
                  value={client.id === "claude" ? claudeInstallCommand : marketplaceCommand}
                  label={client.name}
                />
              </>
            )}
            {client.id === "generic" && <McpCodePreview value={skillInstallCommand} label={client.name} />}
            {client.id !== "claude" && (
              <div className="flex flex-wrap gap-3 text-12">
                {client.id !== "generic" && (
                  <a
                    className="text-primary underline"
                    href={
                      client.id === "desktop"
                        ? "https://support.claude.com/en/articles/13837440-use-plugins-in-claude"
                        : client.id === "chatgpt"
                          ? "https://developers.openai.com/plugins/build/plugins"
                          : "https://developers.openai.com/plugins/build/plugins"
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t("account_settings.mcp.guide")}
                  </a>
                )}
                <a
                  className="text-primary underline"
                  href={client.id === "desktop" ? "/skills/plane-workflow-claude.zip" : "/skills/plane-workflow.zip"}
                  download={client.id === "desktop" ? "plane-workflow-claude.zip" : "plane-workflow.zip"}
                >
                  {t(
                    client.id === "desktop"
                      ? "account_settings.skills.download_plugin"
                      : "account_settings.skills.download"
                  )}
                </a>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
