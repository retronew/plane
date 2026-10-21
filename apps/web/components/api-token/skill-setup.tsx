import { useSyncExternalStore } from "react";
import { useTranslation } from "@plane/i18n";
import { ApiTokenCopyButton } from "./copy-feedback";
import { McpCodePreview } from "./mcp-code-preview";

const subscribe = () => () => {};
const getOrigin = () => window.location.origin;
const getServerOrigin = () => "";
const marketplaceCommand =
  "codex plugin marketplace add retronew/plane --ref preview\ncodex plugin add plane-workflow@plane-openai";
const skillInstallCommand =
  "npx skills add https://github.com/retronew/plane/tree/preview/plugins/plane-workflow/portable/plane-workflow --skill plane-workflow";

export type SkillClient = "claude" | "desktop" | "chatgpt" | "codex" | "generic";

export function buildSkillAgentPrompt(client: SkillClient, origin: string) {
  if (client === "generic")
    return `请为当前 AI 客户端安装 Plane Workflow 技能。先检查 shell、Node.js/npx 和客户端技能加载能力；可用时先运行 ${skillInstallCommand} --list，确认远程 preview 源存在且能发现 plane-workflow。--list 只发现技能，不会安装；若源不存在或命令失败，报告原因，不声称已安装。确认来源后运行 ${skillInstallCommand}，让用户选择目标客户端和项目级或全局安装范围；没有明确授权，不默认添加 --global、--agent 或 --yes。保留已有技能和配置，遇到覆盖先比较并征求确认。安装后运行 npx skills list（全局安装时使用 npx skills list --global），并检查当前客户端是否实际加载 plane-workflow，按需重新加载。没有 shell、npx 或受支持的技能加载方式时，提供 ${origin}/skills/plane-workflow/SKILL.md 备用：检查内容，按客户端文档安装；不支持技能时可作为项目或自定义指令，检查长度限制，不能静默截断。只能粘贴到对话时说明仅在当前对话生效，不假装持久安装。MCP 独立配置：使用 Plane 的 MCP 菜单获取当前客户端连接方式，凭据通过安全入口提供，不读取或回显令牌。最后分别报告技能安装／加载和 MCP 连通结果；有 MCP 工具时只读查询身份或项目，不创建数据。`;
  const setup =
    client === "claude"
      ? "检查 Claude 插件支持后，运行 claude plugin marketplace add retronew/plane，再运行 claude plugin install plane-workflow@plane-ai。通过客户端安全配置入口填写 Plane 连接信息。"
      : client === "desktop"
        ? `在 Claude Desktop 打开 Customize → Plugins → Add → Add marketplace → Add from a repository，添加 https://github.com/retronew/plane（或 retronew/plane），然后在 plane-ai 市场中安装 plane-workflow。先检查已有市场与插件，避免重复。优先通过桌面界面添加市场并安装，不用 Claude Code CLI 代替桌面安装。若有界面操作工具就完成这些步骤；没有时说明所需人工操作，不声称已安装。备用插件包：${origin}/skills/plane-workflow-claude.zip，可在 Customize → Plugins 上传。普通聊天附件不是插件安装。官方说明：https://support.claude.com/en/articles/13837440-use-plugins-in-claude 。桌面 Chat 支持技能和命令，hooks、子代理和本地 MCP 的运行能力按 Chat/Cowork 实际环境检查。`
        : client === "chatgpt"
          ? `在 ChatGPT 桌面客户端点击左下角设置 → 插件 → 右上角添加 → 添加插件市场，填写仓库 https://github.com/retronew/plane；若表单有分支或版本字段填 preview，若有仓库子目录字段留空。按实际表单完成添加，再从 plane-openai 市场找到 plane-workflow 并安装。先检查已有市场，避免重复添加；不要进入 Admin Console 或工作区管理员导入流程。若缺少界面操作工具，说明最少人工步骤，不假装成功。官方仓库市场说明：https://developers.openai.com/plugins/build/plugins 。备用：下载 ${origin}/skills/plane-workflow.zip，在账号支持时通过 Plugins → Skills → Create → Upload from your computer 上传 Skill。普通聊天附件不算安装，Skill ZIP 也不是完整插件 ZIP。`
          : `优先按 https://developers.openai.com/plugins/build/plugins 安装 OpenAI 插件：先检查远程 preview 分支是否包含 .agents/plugins/marketplace.json 和 plugins/plane-workflow-openai/plugin.json；如文件尚未发布，明确报告，不假装成功。可用时先运行 codex plugin add --help 核对当前 CLI 支持安装命令，再依次运行：
${marketplaceCommand}
用 codex plugin marketplace list 核对市场注册，再用 codex plugin list --marketplace plane-openai 确认 plane-workflow 已安装；市场注册不等于插件已安装。当前 CLI 不支持时，按照客户端提供的 Plugins Directory 安装 plane-openai 市场中的 plane-workflow。没有 CLI 或界面工具时说明最少人工步骤，不编造安装命令。${client === "codex" ? `备用：下载 ${origin}/skills/plane-workflow/SKILL.md，检查后安装到 ~/.agents/skills/plane-workflow/SKILL.md；已有文件不同则询问再替换。` : `备用：下载 ${origin}/skills/plane-workflow.zip，在支持上传的账号中通过 Plugins → Skills → Create 上传；普通聊天附件不算安装。网页或移动端没有自定义市场入口时不要假设支持。`}`;
  return `请帮我为 ${client === "claude" ? "Claude Code" : client === "desktop" ? "Claude Desktop" : client === "chatgpt" ? "ChatGPT" : "Codex"} 安装 Plane Workflow 技能／插件。\n\n${setup}\n\n保留已有插件和配置，不读取或回显个人令牌。插件安装与 MCP 连接分开：检查是否已有 Plane MCP，缺少时引导我进入 Plane「MCP」设置。ChatGPT 官方客户端可按 https://learn.chatgpt.com/docs/extend/mcp?surface=cli 使用流式 HTTP，并在 ~/.codex/config.toml 配置 bearer_token_env_var；网页不读取本地配置。\n\n安装后核对插件／技能是否实际出现；有 MCP 工具时只读查询身份和项目，不创建数据。分别报告市场注册、插件／技能安装和 MCP 连通结果，注明需要重启或用户授权的步骤。`;
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
                  value={
                    client.id === "claude"
                      ? "claude plugin marketplace add retronew/plane\nclaude plugin install plane-workflow@plane-ai"
                      : marketplaceCommand
                  }
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
                  href={
                    client.id === "desktop"
                      ? "/skills/plane-workflow-claude.zip"
                      : client.id === "chatgpt"
                        ? "/skills/plane-workflow.zip"
                        : "/skills/plane-workflow/SKILL.md"
                  }
                  download={
                    client.id === "desktop"
                      ? "plane-workflow-claude.zip"
                      : client.id === "chatgpt"
                        ? "plane-workflow.zip"
                        : "SKILL.md"
                  }
                >
                  {t("account_settings.skills.download", { name: client.name })}
                </a>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
