/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState, useSyncExternalStore } from "react";
import { observer } from "mobx-react";
import { Code } from "lucide-react";
import { Button } from "@makeplane/propel/components/button";
import { InputField } from "@makeplane/propel/components/input-field";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Collapsible } from "@base-ui/react/collapsible";
import { ApiTokenCopyButton } from "./copy-feedback";
import { API_BASE_URL } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { useUser } from "@/hooks/store/user";
import { useWorkspace } from "@/hooks/store/use-workspace";
import { buildMcpClientConfig } from "./mcp-client-config";

import { McpCodePreview } from "./mcp-code-preview";
const subscribeToOrigin = () => () => {};
const getOrigin = () => window.location.origin;
const getServerOrigin = () => "";
type Client =
  | "cursor"
  | "vscode"
  | "claude"
  | "json"
  | "chatgpt"
  | "desktop"
  | "windsurf"
  | "cline"
  | "roo"
  | "gemini"
  | "codex";
type Props = { token?: string };

export const ApiTokenMcpSetup = observer(function ApiTokenMcpSetup({ token }: Props) {
  const { t } = useTranslation();
  const { data: currentUser } = useUser();
  const { workspaces } = useWorkspace();
  const [personalToken, setPersonalToken] = useState("");
  const [activeClient, setActiveClient] = useState<Client | null>(null);
  const [showMore, setShowMore] = useState(false);
  const origin = useSyncExternalStore(subscribeToOrigin, getOrigin, getServerOrigin);
  const mcpUrl = `${API_BASE_URL || origin}/mcp`;
  const workspaceList = Object.values(workspaces);
  const workspace = workspaceList.find((item) => item.id === currentUser?.last_workspace_id) ?? workspaceList[0];
  const resolvedToken = token || personalToken.trim();
  const config = buildMcpClientConfig(mcpUrl, resolvedToken || "YOUR_PERSONAL_API_TOKEN", workspace?.slug);
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
      guide: "https://platform.openai.com/docs/guides/developer-mode",
    },
    {
      id: "windsurf",
      name: "Windsurf",
      logo: "windsurf.svg",
      action: t("account_settings.mcp.guide"),
      guide: "https://docs.windsurf.com/windsurf/cascade/mcp",
    },
    {
      id: "cline",
      name: "Cline",
      logo: "cline.svg",
      action: t("account_settings.mcp.guide"),
      guide: "https://docs.cline.bot/mcp/configuring-mcp-servers",
    },
    {
      id: "roo",
      name: "Roo Code",
      logo: "roocode.svg",
      action: t("account_settings.mcp.guide"),
      guide: "https://docs.roocode.com/features/mcp/using-mcp-in-roo",
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
      guide: "https://developers.openai.com/codex/mcp",
    },
    {
      id: "json" as const,
      name: t("workspace_settings.settings.api_tokens.mcp_other_clients"),
      logo: "mcp.svg",
      action: t("account_settings.mcp.download"),
    },
  ];
  const snippets: Partial<Record<Client, string>> = {
    claude: config.claudeCommand,
    vscode: JSON.stringify({ servers: { plane: { type: "http", ...config.cursorConfig } } }, null, 4),
    windsurf: JSON.stringify({ mcpServers: { plane: { serverUrl: mcpUrl, headers: config.headers } } }, null, 4),
    cline: JSON.stringify({ mcpServers: { plane: { type: "streamableHttp", ...config.cursorConfig } } }, null, 4),
    roo: JSON.stringify({ mcpServers: { plane: { type: "streamable-http", ...config.cursorConfig } } }, null, 4),
    gemini: JSON.stringify({ mcpServers: { plane: { httpUrl: mcpUrl, headers: config.headers } } }, null, 4),
    codex: `[mcp_servers.plane]\nurl = ${JSON.stringify(mcpUrl)}\nbearer_token_env_var = "PLANE_API_TOKEN"\n\n[mcp_servers.plane.http_headers]\n${workspace ? `"X-Workspace-Slug" = ${JSON.stringify(workspace.slug)}` : ""}`,
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
    <div className="mt-5 space-y-4 [&_button]:text-12 [&_input]:h-8 [&_input]:text-12 [&_input::placeholder]:text-12">
      {!token && (
        <div className="space-y-2">
          <label htmlFor="mcp-personal-token" className="mb-3 block text-13 font-medium">
            {t("account_settings.mcp.token_label")}
          </label>
          <InputField
            size="lg"
            orientation="vertical"
            id="mcp-personal-token"
            type="password"
            autoComplete="off"
            value={personalToken}
            onChange={(event) => setPersonalToken(event.target.value)}
            placeholder={t("account_settings.mcp.token_placeholder")}
          />
          <p className="text-11 text-tertiary">{t("account_settings.mcp.token_hint")}</p>
        </div>
      )}
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
                    disabled={Boolean(client.href) && !resolvedToken}
                    label={client.action}
                    onClick={() => {
                      if (client.guide) window.open(client.guide, "_blank", "noopener,noreferrer");
                      else if (client.href) window.location.assign(client.href);
                      else download();
                    }}
                  />
                )}
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
                      {resolvedToken
                        ? t("account_settings.mcp.code_description")
                        : t("account_settings.mcp.template_hint", { token: "YOUR_PERSONAL_API_TOKEN" })}
                    </p>
                  </div>
                  {activeClient === client.id && client.id === "chatgpt" && (
                    <p className="text-13 text-secondary">{t("account_settings.mcp.chatgpt_hint")}</p>
                  )}
                  {client.id !== "chatgpt" && (
                    <McpCodePreview value={snippets[client.id] ?? config.jsonConfig} label={client.name} />
                  )}
                </div>
              </Collapsible.Panel>
            </Collapsible.Root>
          ))}
      </div>
      <Button
        variant="secondary"
        size="sm"
        stretch="auto"
        label={t(showMore ? "account_settings.mcp.fewer_tools" : "account_settings.mcp.more_tools")}
        onClick={() => {
          setShowMore(!showMore);
          setActiveClient(null);
        }}
      />
      <p className="text-11 break-all text-tertiary">
        {t("account_settings.mcp.server_url")}:{" "}
        <code className="font-mono rounded bg-surface-2 px-1.5 py-0.5 text-11 text-secondary">{mcpUrl}</code>
      </p>
    </div>
  );
});
