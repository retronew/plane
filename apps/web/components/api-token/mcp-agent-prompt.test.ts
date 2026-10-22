import { describe, expect, it } from "vitest";
import { buildMcpAgentPrompt } from "./mcp-agent-prompt";
import type { McpClient } from "./mcp-agent-prompt";

const clients: McpClient[] = [
  "chatgpt",
  "codex",
  "claude",
  "desktop",
  "cursor",
  "vscode",
  "windsurf",
  "cline",
  "roo",
  "gemini",
  "json",
];

describe("MCP agent installation prompts", () => {
  it.each(clients)("includes connection context and read-only verification for %s", (client) => {
    const prompt = buildMcpAgentPrompt(client, client, "https://plane.example/mcp");
    expect(prompt).toContain("https://plane.example/mcp");
    expect(prompt).not.toContain("X-Workspace-Slug");
    expect(prompt).toContain(client === "chatgpt" ? "OAuth" : "PLANE_API_TOKEN");
    expect(prompt).toContain("只读查询工作区");
    expect(prompt).toContain("保留其他服务器配置");
    expect(prompt).not.toContain("/skills/plane-workflow");
    expect(prompt).not.toContain("claude plugin install");
  });

  it("does not fabricate workspace or include Skill installation in Codex MCP setup", () => {
    const prompt = buildMcpAgentPrompt("codex", "Codex", "https://plane.example/mcp");
    expect(prompt).not.toContain("X-Workspace-Slug");
    expect(prompt).not.toContain("~/.agents/skills");
    expect(prompt).toContain("bearer_token_env_var");
    expect(prompt).toContain("~/.codex/config.toml");
    expect(prompt).not.toContain("设置 → 插件");
  });

  it.each(clients)("requires explicit workspace targets without defaults for %s", (client) => {
    const prompt = buildMcpAgentPrompt(client, client, "https://plane.example/mcp");
    expect(prompt).toContain('workspace(action="list")');
    expect(prompt).toContain("每次调用工作区相关工具都明确传入 workspace_slug");
    expect(prompt).toContain("目标工作区不明确时先询问用户");
    expect(prompt).toContain("不猜测跨工作区的同编号工作项");
    expect(prompt).toContain("不使用默认工作区或回退目标");
    expect(prompt).toContain("每次请求都会校验当前用户在目标工作区的权限");
    expect(prompt).not.toContain('"workspaceSlug"');
    expect(prompt).not.toContain("X-Workspace-Slug");
    expect(prompt).not.toContain("http_headers");
  });

  it("explains ChatGPT authentication constraints", () => {
    const prompt = buildMcpAgentPrompt("chatgpt", "ChatGPT", "https://plane.example/mcp");
    expect(prompt).toContain("点击连接，通过 OAuth 登录 Plane");
    expect(prompt).not.toContain("Settings → MCP servers → Add server");
    expect(prompt).toContain("Streamable HTTP");
    expect(prompt).not.toContain("bearer_token_env_var");
    expect(prompt).toContain("不需要填写个人 Token");
  });
});
