import { buildPortableInstallPrompt } from "./portable-skill-prompt";
import { useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { ChevronDown, SquareTerminal } from "lucide-react";
import { Collapsible } from "@base-ui/react/collapsible";
import { useTranslation } from "@plane/i18n";
import { cn } from "@plane/utils";
import { ApiTokenCopyButton } from "./copy-feedback";
import { InlineCopyCode } from "./inline-copy-code";

const subscribe = () => () => {};
const getOrigin = () => window.location.origin;
const getServerOrigin = () => "";

// Marketplaces are published to a small distribution repository (synced from this
// monorepo by .github/workflows/sync-plugins.yml) so clients don't clone the monorepo.
const REPO = "retronew/plane-plugins";
const REPO_URL = `https://github.com/${REPO}`;
const BRANCH = "main";
const PLUGIN = "plane-workflow";
const CLAUDE_MARKETPLACE = "plane-ai";
const OPENAI_MARKETPLACE = "plane-openai";
const claudeCommands = [
  `claude plugin marketplace add ${REPO}`,
  `claude plugin install ${PLUGIN}@${CLAUDE_MARKETPLACE}`,
];
const codexCommands = [
  `codex plugin marketplace add ${REPO}`,
  `codex plugin add ${PLUGIN}@${OPENAI_MARKETPLACE}`,
  `codex plugin list --marketplace ${OPENAI_MARKETPLACE}`,
];
// Copilot CLI and VS Code agent plugins read the Claude-format marketplace.
const copilotCommands = [
  `copilot plugin marketplace add ${REPO}`,
  `copilot plugin install ${PLUGIN}@${CLAUDE_MARKETPLACE}`,
];
const vscodeCommands = [`/plugin marketplace add ${REPO}`, `/plugin install ${PLUGIN}@${CLAUDE_MARKETPLACE}`];
const marketplaceCommand = codexCommands.join("\n");
const claudeInstallCommand = claudeCommands.join("\n");

export type SkillClient = "claude" | "desktop" | "chatgpt" | "codex" | "copilot" | "generic";

export function buildPluginAgentPrompt(client: SkillClient, origin: string) {
  const portable = buildPortableInstallPrompt(origin);
  const setup =
    client === "generic"
      ? portable
      : client === "claude"
        ? `检查 Claude Code 插件支持和已有安装，再运行：\n${claudeInstallCommand}\n核对插件安装及全部 8 个 skills 的实际加载。安装后引导用户进入 Plane「MCP」菜单手动连接。`
        : client === "copilot"
          ? `检查 GitHub Copilot CLI 是否可用（copilot plugin --help）以及已有安装，再运行：\n${copilotCommands.join("\n")}\n核对插件安装及全部 8 个 skills 的实际加载；CLI 不可用时明确停止并给出命令供用户手动执行。安装后引导用户进入 Plane「MCP」菜单手动连接。`
          : client === "desktop"
            ? `在 Claude Desktop 打开 Customize → Plugins → Add → Add marketplace → Add from a repository，添加 ${REPO_URL}，然后从 plane-ai 安装 plane-workflow。先检查已有安装，避免重复；不用 Claude Code CLI 代替桌面安装。没有界面工具时提供人工步骤。备用插件包：${origin}/skills/plane-workflow-claude.zip，在 Customize → Plugins 上传。也可下载 ${origin}/skills/plane-workflow.zip，解压后按客户端支持的方式逐个上传或安装全部 8 个 skills，不假设支持一次上传多技能 ZIP；两种包都不包含 MCP。普通聊天附件不算安装。`
            : `只通过官方 Codex CLI 安装，不尝试 ChatGPT 或 Codex desktop UI 自动化。先在 PATH 或宿主明确提供的位置检测官方 codex 可执行文件；不搜索其他路径或凭据。缺少 CLI 时明确停止，并给出以下命令供用户在目标客户端同一 host 手动执行，不声称已安装。CLI 可用时检查 codex plugin add --help 和已有安装，再依次运行：\n${marketplaceCommand}\n市场注册不等于插件已安装。核对 plane-workflow 安装结果，并在同一 host 的目标客户端重新加载，实际验证全部 8 个 skills 已加载；无法验证时明确标记未验证。不能承诺 ChatGPT 云端、网页或其他 host 同步。CLI 不支持插件时提供八技能备用安装方案：${portable}`;
  return `请为当前客户端安装 Plane Workflow 的全部 8 个 skills。所有渠道共用 canonical 源 plugins/plane-workflow/skills。\n\n${setup}\n\n保留已有插件、技能和配置，遇到覆盖先比较并征求确认。技能安装不等于 MCP 连接。OpenAI 插件内置实例 MCP 地址：安装后点击连接，通过 OAuth 登录并授权工作区，先确认包内地址属于目标实例。其他技能包的 MCP 由用户独立手动配置，可在 Plane「MCP」菜单获取 URL，通过客户端安全入口提供 API Token。不读取、搜集或回显凭据。\n\n分别报告安装、实际加载和 MCP 连通结果；未连接 MCP 时标记待用户连接授权。已有 MCP 工具时先调用 workspace(action="list") 只读列出可访问工作区；仅继承用户已明确的目标 workspace_slug，目标不明确时先询问。后续项目等工作区查询必须显式传入该 workspace_slug，不使用默认工作区或回退目标，不创建数据。`;
}

// A manual step is a translated sentence followed by the values the user must
// type or paste (shown as copyable code) and commands to run (one per line).
type Field = "repo" | "branch" | "marketplace" | "plugin" | "setting";
type ManualStep = { text: string; values?: { field: Field; value: string }[]; commands?: string[] };
type ManualClient = {
  id: string;
  name: string;
  logo?: string;
  mode: "plugin" | "skills";
  steps: ManualStep[];
  guide?: string;
  download?: "plugin" | "skills";
};

const clientLogo = (logo?: string) =>
  logo ? (
    <img
      src={`/logos/mcp-clients/${logo}`}
      alt=""
      className={cn(
        "size-4 shrink-0 object-contain",
        !logo.endsWith("-color.svg") && !logo.endsWith(".ico") && "dark:invert"
      )}
    />
  ) : (
    <SquareTerminal aria-hidden="true" className="size-4 shrink-0 text-secondary" />
  );

const panelClass =
  "h-[var(--collapsible-panel-height)] overflow-hidden opacity-100 transition-[height,opacity] duration-200 ease-out data-ending-style:h-0 data-ending-style:opacity-0 data-starting-style:h-0 data-starting-style:opacity-0 motion-reduce:transition-none";

function Chevron({ open }: { open: boolean }) {
  return (
    <ChevronDown
      aria-hidden="true"
      className={cn(
        "size-4 shrink-0 text-tertiary transition-transform duration-200 motion-reduce:transition-none",
        open && "rotate-180"
      )}
    />
  );
}

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible.Root open={open} onOpenChange={setOpen} className="overflow-hidden rounded-lg border border-subtle">
      <Collapsible.Trigger className="focus-visible:outline-primary flex w-full items-center gap-3 bg-surface-1 px-3 py-2.5 text-left transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2">
        <span className="min-w-0 flex-1">
          <span className="block text-13 font-medium text-primary">{title}</span>
          <span className="block text-11 text-tertiary">{description}</span>
        </span>
        <Chevron open={open} />
      </Collapsible.Trigger>
      <Collapsible.Panel className={panelClass}>
        <div className="divide-y divide-subtle border-t border-subtle">{children}</div>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}

export function ApiTokenPluginSetup() {
  const { t } = useTranslation();
  const origin = useSyncExternalStore(subscribe, getOrigin, getServerOrigin);
  const [activeClient, setActiveClient] = useState<string | null>(null);

  const agentClients: { id: SkillClient; name: string; logo?: string }[] = [
    { id: "chatgpt", name: "ChatGPT", logo: "openai.svg" },
    { id: "codex", name: "Codex", logo: "codex-color.svg" },
    { id: "desktop", name: "Claude Desktop", logo: "claude-color.svg" },
    { id: "claude", name: "Claude Code", logo: "claudecode-color.svg" },
    { id: "copilot", name: "GitHub Copilot CLI" },
  ];

  const step = (key: string, extra?: Omit<ManualStep, "text">): ManualStep => ({
    text: t(`account_settings.skills.${key}`),
    ...extra,
  });
  const manualClients: ManualClient[] = [
    {
      id: "chatgpt",
      name: "ChatGPT",
      logo: "openai.svg",
      mode: "plugin",
      guide: "https://developers.openai.com/plugins/build/plugins",
      download: "skills",
      steps: [
        step("chatgpt_step_1"),
        step("chatgpt_step_2", {
          values: [
            { field: "repo", value: REPO_URL },
            { field: "branch", value: BRANCH },
          ],
        }),
        step("chatgpt_step_3", {
          values: [
            { field: "marketplace", value: OPENAI_MARKETPLACE },
            { field: "plugin", value: PLUGIN },
          ],
        }),
      ],
    },
    {
      id: "codex",
      name: "Codex",
      logo: "codex-color.svg",
      mode: "plugin",
      guide: "https://developers.openai.com/plugins/build/plugins",
      download: "skills",
      steps: [step("codex_step_1", { commands: codexCommands }), step("codex_step_2")],
    },
    {
      id: "desktop",
      name: "Claude Desktop",
      logo: "claude-color.svg",
      mode: "plugin",
      guide: "https://support.claude.com/en/articles/13837440-use-plugins-in-claude",
      download: "plugin",
      steps: [
        step("desktop_step_1"),
        step("desktop_step_2", { values: [{ field: "repo", value: REPO_URL }] }),
        step("desktop_step_3", {
          values: [
            { field: "marketplace", value: CLAUDE_MARKETPLACE },
            { field: "plugin", value: PLUGIN },
          ],
        }),
      ],
    },
    {
      id: "claude",
      name: "Claude Code",
      logo: "claudecode-color.svg",
      mode: "plugin",
      guide: "https://code.claude.com/docs/en/plugins/install",
      steps: [step("claude_step_1", { commands: claudeCommands }), step("claude_step_2")],
    },
    {
      id: "copilot",
      name: "GitHub Copilot CLI",
      mode: "plugin",
      guide: "https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference",
      steps: [step("copilot_step_1", { commands: copilotCommands }), step("copilot_step_2")],
    },
    {
      id: "vscode",
      name: "VS Code",
      logo: "vscode.ico",
      mode: "plugin",
      guide: "https://code.visualstudio.com/docs/copilot/customization/agent-plugins",
      steps: [
        step("vscode_step_1", { values: [{ field: "setting", value: "chat.plugins.enabled" }] }),
        step("vscode_step_2", { commands: vscodeCommands }),
        step("vscode_step_3"),
      ],
    },
  ];

  return (
    <div className="mt-5 space-y-3 [&_button]:text-12">
      <p className="text-13 text-secondary">{t("account_settings.plugins.description")}</p>
      <Section
        title={t("account_settings.skills.agent_title")}
        description={t("account_settings.skills.agent_description")}
      >
        {agentClients.map((client) => (
          <div key={client.id} className="flex items-center gap-3 bg-surface-1 px-3 py-2">
            {clientLogo(client.logo)}
            <span className="min-w-0 flex-1 text-13">{client.name}</span>
            <ApiTokenCopyButton
              value={buildPluginAgentPrompt(client.id, origin)}
              label={t("account_settings.mcp.agent_prompt")}
              ariaLabel={t("account_settings.skills.agent_prompt_label", { name: client.name })}
            />
          </div>
        ))}
      </Section>
      <Section
        title={t("account_settings.skills.manual_title")}
        description={t("account_settings.plugins.manual_description")}
      >
        {manualClients.map((client) => {
          const open = activeClient === client.id;
          return (
            <Collapsible.Root
              key={client.id}
              open={open}
              onOpenChange={(next) => setActiveClient(next ? client.id : null)}
            >
              <Collapsible.Trigger
                aria-label={t("account_settings.skills.view_steps", { name: client.name })}
                className="focus-visible:outline-primary flex w-full items-center gap-3 bg-surface-1 px-3 py-2 text-left transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2"
              >
                {clientLogo(client.logo)}
                <span className="min-w-0 flex-1 text-13">{client.name}</span>
                <span className="rounded bg-layer-1 px-1.5 py-0.5 text-11 text-tertiary">
                  {t(
                    client.mode === "plugin"
                      ? "account_settings.skills.mode_plugin"
                      : "account_settings.skills.mode_skills"
                  )}
                </span>
                <Chevron open={open} />
              </Collapsible.Trigger>
              <Collapsible.Panel className={panelClass}>
                <div className="space-y-3 border-t border-subtle bg-surface-2 px-3 py-3">
                  <ol className="list-decimal space-y-2.5 pl-5 text-12 text-secondary marker:text-tertiary">
                    {client.steps.map((item) => (
                      <li key={item.text} className="space-y-1.5 leading-6">
                        <span>{item.text}</span>
                        {item.values && (
                          <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                            {item.values.map(({ field, value }) => (
                              <span key={field} className="inline-flex max-w-full items-center gap-1.5">
                                <span className="shrink-0 text-11 text-tertiary">
                                  {t(`account_settings.skills.field_${field}`)}
                                </span>
                                <InlineCopyCode value={value} />
                              </span>
                            ))}
                          </span>
                        )}
                        {item.commands && (
                          <span className="block space-y-1">
                            {item.commands.map((command) => (
                              <InlineCopyCode key={command} value={command} block />
                            ))}
                          </span>
                        )}
                      </li>
                    ))}
                  </ol>
                  {(client.guide || client.download) && (
                    <div className="flex flex-wrap gap-3 text-12">
                      {client.guide && (
                        <a
                          className="text-primary underline"
                          href={client.guide}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {t("account_settings.mcp.guide")}
                        </a>
                      )}
                      {client.download && (
                        <a
                          className="text-primary underline"
                          href={
                            client.download === "plugin"
                              ? "/skills/plane-workflow-claude.zip"
                              : "/skills/plane-workflow.zip"
                          }
                          download={client.download === "plugin" ? "plane-workflow-claude.zip" : "plane-workflow.zip"}
                        >
                          {t(
                            client.download === "plugin"
                              ? "account_settings.skills.download_plugin"
                              : "account_settings.skills.download"
                          )}
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </Collapsible.Panel>
            </Collapsible.Root>
          );
        })}
      </Section>
    </div>
  );
}
