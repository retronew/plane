/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState, useSyncExternalStore } from "react";
import { observer } from "mobx-react";
import { ChevronDown, Code } from "lucide-react";
import { Button } from "@makeplane/propel/components/button";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Collapsible } from "@base-ui/react/collapsible";
import { ApiTokenCopyButton } from "./copy-feedback";
import { API_BASE_URL } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { buildMcpClientConfig } from "./mcp-client-config";
import { buildMcpAgentPrompt } from "./mcp-agent-prompt";
import type { McpClient } from "./mcp-agent-prompt";

import { McpCodePreview } from "./mcp-code-preview";
const subscribeToOrigin = () => () => {};
const getOrigin = () => window.location.origin;
const getServerOrigin = () => "";
type Client = McpClient;
type Props = { token?: string };

export const ApiTokenMcpSetup = observer(function ApiTokenMcpSetup({ token }: Props) {
  const { t } = useTranslation();
  const [activeClient, setActiveClient] = useState<Client | null>(null);
  const [showMore, setShowMore] = useState(false);
  const origin = useSyncExternalStore(subscribeToOrigin, getOrigin, getServerOrigin);
  const mcpUrl = `${API_BASE_URL || origin}/mcp`;
  const resolvedToken = token;
  const config = buildMcpClientConfig(mcpUrl, resolvedToken || "YOUR_PERSONAL_API_TOKEN");
  const clients: { id: Client; name: string; logo: string; action: string; href?: string; guide?: string }[] = [
    {
      id: "cursor" as const,
      name: "Cursor",
      logo: "cursor.svg",
      action: t("account_settings.mcp.add"),
      href: config.cursorInstallUrl,
    },
    {
      id: "vscode" as const,
      name: "VS Code",
      logo: "vscode.ico",
      action: t("account_settings.mcp.add"),
      href: config.vscodeInstallUrl,
    },
    { id: "claude", name: "Claude Code", logo: "claudecode-color.svg", action: t("account_settings.mcp.copy_command") },
    {
      id: "desktop",
      name: "Claude Desktop",
      logo: "claude-color.svg",
      action: t("account_settings.mcp.guide"),
      guide: "https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp",
    },
    {
      id: "chatgpt",
      name: "ChatGPT",
      logo: "openai.svg",
      action: t("account_settings.mcp.guide"),
      guide: "https://learn.chatgpt.com/docs/extend/mcp?surface=cli",
    },
    {
      id: "windsurf",
      name: "Windsurf",
      logo: "windsurf.svg",
      action: t("account_settings.mcp.guide"),
      guide: "https://docs.devin.ai/desktop/cascade/mcp",
    },
    {
      id: "cline",
      name: "Cline",
      logo: "cline.svg",
      action: t("account_settings.mcp.guide"),
      guide: "https://docs.cline.bot/mcp/mcp-overview",
    },
    {
      id: "roo",
      name: "Roo Code",
      logo: "roocode.svg",
      action: t("account_settings.mcp.guide"),
      guide: "https://roocodeinc.github.io/Roo-Code/features/mcp/using-mcp-in-roo/",
    },
    {
      id: "gemini",
      name: "Gemini CLI",
      logo: "geminicli-color.svg",
      action: t("account_settings.mcp.guide"),
      guide: "https://geminicli.com/docs/tools/mcp-server/",
    },
    {
      id: "codex",
      name: "Codex",
      logo: "codex-color.svg",
      action: t("account_settings.mcp.guide"),
      guide: "https://developers.openai.com/codex/extend/mcp",
    },
    {
      id: "json" as const,
      name: t("workspace_settings.settings.api_tokens.mcp_other_clients"),
      logo: "mcp.svg",
      action: t("account_settings.mcp.download"),
    },
  ];
  const openaiConfig = `[mcp_servers.plane]\nurl = ${JSON.stringify(mcpUrl)}\nbearer_token_env_var = "PLANE_API_TOKEN"`;
  const snippets: Partial<Record<Client, string>> = {
    chatgpt: JSON.stringify({ url: mcpUrl, transport: "streamable-http", authentication: "oauth" }, null, 4),
    claude: config.claudeCommand,
    vscode: JSON.stringify({ servers: { plane: { type: "http", ...config.cursorConfig } } }, null, 4),
    windsurf: JSON.stringify({ mcpServers: { plane: { serverUrl: mcpUrl, headers: config.headers } } }, null, 4),
    cline: JSON.stringify({ mcpServers: { plane: { type: "streamableHttp", ...config.cursorConfig } } }, null, 4),
    roo: JSON.stringify({ mcpServers: { plane: { type: "streamable-http", ...config.cursorConfig } } }, null, 4),
    gemini: JSON.stringify({ mcpServers: { plane: { httpUrl: mcpUrl, headers: config.headers } } }, null, 4),
    codex: openaiConfig,
    desktop: JSON.stringify({ url: mcpUrl, headers: config.headers }, null, 4),
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([config.jsonConfig], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "plane-mcp.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mt-5 space-y-4 [&_button]:text-12">
      <div className="divide-y divide-subtle overflow-hidden rounded-lg border border-subtle">
        {(
          [
            "chatgpt",
            "desktop",
            "claude",
            "cursor",
            "vscode",
            "windsurf",
            "cline",
            "roo",
            "gemini",
            "codex",
            "json",
          ] as Client[]
        )
          .flatMap((id) => clients.filter((client) => client.id === id))
          .filter((client) => showMore || ["chatgpt", "desktop", "claude", "cursor", "vscode"].includes(client.id))
          .map((client) => (
            <Collapsible.Root
              key={client.id}
              open={activeClient === client.id}
              onOpenChange={(open) => setActiveClient(open ? client.id : null)}
            >
              <div className="flex flex-wrap items-center gap-3 bg-surface-1 px-3 py-2">
                <img
                  src={`/logos/mcp-clients/${client.logo}`}
                  alt=""
                  className={`size-4 shrink-0 object-contain ${client.logo.endsWith("-color.svg") || client.logo.endsWith(".ico") ? "" : "dark:invert"}`}
                />
                <span className="min-w-0 flex-1 text-13 font-medium">{client.name}</span>
                {client.id === "claude" ? (
                  <ApiTokenCopyButton value={config.claudeCommand} label={client.action} />
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    stretch="auto"
                    label={client.action}
                    onClick={() => {
                      if (client.guide) window.open(client.guide, "_blank", "noopener,noreferrer");
                      else if (client.href) window.location.assign(client.href);
                      else download();
                    }}
                  />
                )}
                <ApiTokenCopyButton
                  value={buildMcpAgentPrompt(client.id, client.name, mcpUrl)}
                  label={t("account_settings.mcp.agent_prompt")}
                  ariaLabel={t("account_settings.mcp.agent_prompt_label", { name: client.name })}
                />
                <IconButton
                  variant="ghost"
                  size="sm"
                  icon={<Code className="size-4" />}
                  aria-label={t("account_settings.mcp.view_code", { name: client.name })}
                  render={<Collapsible.Trigger />}
                />
              </div>
              <Collapsible.Panel className="h-[var(--collapsible-panel-height)] overflow-hidden bg-surface-2 opacity-100 transition-[height,opacity] duration-200 ease-out data-ending-style:h-0 data-ending-style:opacity-0 data-starting-style:h-0 data-starting-style:opacity-0 motion-reduce:transition-none">
                <div className="space-y-2 border-t border-subtle px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-11 text-tertiary">
                      {client.id === "chatgpt"
                        ? t("account_settings.mcp.chatgpt_hint")
                        : client.id === "codex"
                          ? t("account_settings.mcp.openai_config_hint")
                          : resolvedToken
                            ? t("account_settings.mcp.code_description")
                            : t("account_settings.mcp.template_hint", { token: "YOUR_PERSONAL_API_TOKEN" })}
                    </p>
                  </div>
                  <McpCodePreview value={snippets[client.id] ?? config.jsonConfig} label={client.name} />
                </div>
              </Collapsible.Panel>
            </Collapsible.Root>
          ))}
        <button
          type="button"
          className="focus-visible:outline-primary flex w-full items-center justify-center gap-2 bg-surface-1 px-3 py-2 text-secondary transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2"
          aria-expanded={showMore}
          onClick={() => {
            setShowMore(!showMore);
            setActiveClient(null);
          }}
        >
          {t(showMore ? "account_settings.mcp.fewer_tools" : "account_settings.mcp.more_tools")}
          <ChevronDown
            aria-hidden="true"
            className={`size-4 transition-transform duration-200 motion-reduce:transition-none ${showMore ? "rotate-180" : ""}`}
          />
        </button>
      </div>
      <p className="text-11 break-all text-tertiary">
        {t("account_settings.mcp.server_url")}:{" "}
        <code className="font-mono rounded bg-surface-2 px-1.5 py-0.5 text-11 text-secondary">{mcpUrl}</code>
      </p>
    </div>
  );
});
