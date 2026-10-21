/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

/** Quote a single POSIX shell argument, including embedded single quotes. */
function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\"'\"'")}'`;
}

function utf8Base64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""));
}

/** Build copyable configurations and installation links without browser globals. */
export function buildMcpClientConfig(url: string, token: string) {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };

  const claudeCommand = [
    `claude mcp add --transport http plane ${shellQuote(url)}`,
    ...Object.entries(headers).map(([name, value]) => `--header ${shellQuote(`${name}: ${value}`)}`),
  ].join(" ");
  const jsonConfig = JSON.stringify({ mcpServers: { plane: { type: "http", url, headers } } }, null, 4);
  const vscodeConfig = { name: "plane", type: "http", url, headers };
  const cursorConfig = { url, headers };
  const cursorInstallUrl = `cursor://anysphere.cursor-deeplink/mcp/install?name=plane&config=${encodeURIComponent(utf8Base64(JSON.stringify(cursorConfig)))}`;
  const vscodeInstallUrl = `vscode:mcp/install?${encodeURIComponent(JSON.stringify(vscodeConfig))}`;

  return { headers, claudeCommand, jsonConfig, vscodeConfig, cursorConfig, cursorInstallUrl, vscodeInstallUrl };
}
