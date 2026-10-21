import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { buildMcpClientConfig } from "./mcp-client-config";

const url = "https://plane.example/mcp";
const token = "personal-api-token";

function commandArguments(command: string): string[] {
  // Replace the executable with a shell function: inspect parsing without starting a client.
  const output = execFileSync("/bin/sh", ["-c", `claude() { printf '%s\\0' "$@"; }; ${command}`], {
    encoding: "utf8",
    env: { PATH: "" },
  });
  return output.split("\0").slice(0, -1);
}

describe("buildMcpClientConfig", () => {
  it("builds the HTTP configurations with the same authentication headers", () => {
    const config = buildMcpClientConfig(url, token);
    const headers = { Authorization: `Bearer ${token}` };

    expect(config.headers).toEqual(headers);
    expect(config.jsonConfig).toBe(JSON.stringify({ mcpServers: { plane: { type: "http", url, headers } } }, null, 4));
    expect(config.vscodeConfig).toEqual({ name: "plane", type: "http", url, headers });
    expect(config.cursorConfig).toEqual({ url, headers });
    expect(commandArguments(config.claudeCommand)).toEqual([
      "mcp",
      "add",
      "--transport",
      "http",
      "plane",
      url,
      "--header",
      `Authorization: Bearer ${token}`,
    ]);
  });

  it("preserves quotes, substitutions, separators, whitespace and newlines as literal shell arguments", () => {
    const unsafeUrl = "https://plane.example/mcp?q='\"&value=$(printf injected);`printf injected`\nnext";
    const unsafeToken = "token'\" $HOME $(printf injected) `printf injected`; & | \\ \nnext";

    expect(commandArguments(buildMcpClientConfig(unsafeUrl, unsafeToken).claudeCommand)).toEqual([
      "mcp",
      "add",
      "--transport",
      "http",
      "plane",
      unsafeUrl,
      "--header",
      `Authorization: Bearer ${unsafeToken}`,
    ]);
  });

  it("encodes the Cursor installation payload as UTF-8 base64 JSON", () => {
    const config = buildMcpClientConfig("https://plane.example/mcp?label=中文&other=✓", "令牌🔑+/=");
    const installUrl = new URL(config.cursorInstallUrl);

    expect(`${installUrl.protocol}//${installUrl.host}${installUrl.pathname}`).toBe(
      "cursor://anysphere.cursor-deeplink/mcp/install"
    );
    expect(installUrl.searchParams.get("name")).toBe("plane");
    const encoded = installUrl.searchParams.get("config")!;
    const decoded = new TextDecoder().decode(Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0)));
    expect(JSON.parse(decoded)).toEqual(config.cursorConfig);
  });

  it("encodes the VS Code installation payload as URI-encoded JSON", () => {
    const config = buildMcpClientConfig("https://plane.example/mcp?x=1&label=中文#fragment", "令牌'\"&#+/=🔑");
    const prefix = "vscode:mcp/install?";

    expect(config.vscodeInstallUrl.startsWith(prefix)).toBe(true);
    expect(JSON.parse(decodeURIComponent(config.vscodeInstallUrl.slice(prefix.length)))).toEqual(config.vscodeConfig);
    expect(config.vscodeInstallUrl.slice(prefix.length)).toBe(encodeURIComponent(JSON.stringify(config.vscodeConfig)));
  });

  it("creates independent configuration values on each call", () => {
    const first = buildMcpClientConfig(url, "first-token");
    first.headers.Authorization = "changed";
    const second = buildMcpClientConfig(url, "second-token");

    expect(second.headers).toEqual({ Authorization: "Bearer second-token" });
    expect(second.jsonConfig).not.toContain("first-token");
  });
});
