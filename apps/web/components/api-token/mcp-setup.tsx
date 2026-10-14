/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";

import { setToast } from "@plane/blocks/toast";
import { API_BASE_URL } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { copyTextToClipboard } from "@plane/utils";
// hooks
import { useUser } from "@/hooks/store/user";
import { useWorkspace } from "@/hooks/store/use-workspace";
import { Copy } from "lucide-react";

type Props = {
  token: string;
};

/** Copyable MCP client configuration for a freshly created API token. */
export const ApiTokenMcpSetup = observer(function ApiTokenMcpSetup({ token }: Props) {
  const { t } = useTranslation();
  const { data: currentUser } = useUser();
  const { workspaces } = useWorkspace();

  // The MCP endpoint is served by the API, next to /api
  const mcpUrl = `${API_BASE_URL || window.location.origin}/mcp`;
  const workspaceList = Object.values(workspaces);
  const workspace =
    workspaceList.find((item) => item.id === currentUser?.last_workspace_id) ?? workspaceList[0] ?? undefined;

  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (workspace) headers["X-Workspace-Slug"] = workspace.slug;

  const claudeCommand = [
    `claude mcp add --transport http plane ${mcpUrl}`,
    ...Object.entries(headers).map(([name, value]) => `--header "${name}: ${value}"`),
  ].join(" ");
  const jsonConfig = JSON.stringify({ mcpServers: { plane: { type: "http", url: mcpUrl, headers } } }, null, 2);

  const snippets = [
    { key: "claude", label: t("workspace_settings.settings.api_tokens.mcp_claude_code"), value: claudeCommand },
    { key: "json", label: t("workspace_settings.settings.api_tokens.mcp_other_clients"), value: jsonConfig },
  ];

  const copy = (value: string) =>
    copyTextToClipboard(value).then(() =>
      setToast({
        type: "success",
        title: `${t("success")}!`,
        message: t("workspace_settings.settings.api_tokens.mcp_config_copied"),
      })
    );

  return (
    <div className="mt-4 space-y-2">
      <div>
        <h6 className="text-13 font-medium">{t("workspace_settings.settings.api_tokens.mcp_title")}</h6>
        <p className="text-11 text-tertiary">
          {workspace
            ? t("workspace_settings.settings.api_tokens.mcp_description", { workspace: workspace.name })
            : t("workspace_settings.settings.api_tokens.mcp_description_no_workspace")}
        </p>
      </div>
      {snippets.map((snippet) => (
        <div key={snippet.key} className="space-y-1">
          <span className="text-11 font-medium text-secondary">{snippet.label}</span>
          <button
            type="button"
            onClick={() => void copy(snippet.value)}
            aria-label={`${t("workspace_settings.settings.api_tokens.mcp_copy")}: ${snippet.label}`}
            className="flex w-full items-start justify-between gap-2 rounded-md border-[0.5px] border-subtle px-3 py-2 text-left outline-none"
          >
            <pre className="font-mono max-h-32 min-w-0 flex-1 overflow-auto text-11 break-all whitespace-pre-wrap">
              {snippet.value}
            </pre>
            <Copy className="mt-0.5 h-4 w-4 flex-shrink-0 text-placeholder" />
          </button>
        </div>
      ))}
    </div>
  );
});
