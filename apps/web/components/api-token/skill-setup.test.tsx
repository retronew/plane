import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiTokenSkillSetup, buildSkillAgentPrompt } from "./skill-setup";

const { writeText } = vi.hoisted(() => ({ writeText: vi.fn().mockResolvedValue(undefined) }));
Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, params?: { name?: string }) => (params?.name ? `${key}:${params.name}` : key),
  }),
}));
vi.mock("@plane/blocks/toast", () => ({ setToast: vi.fn() }));
vi.mock("@plane/utils", () => ({ cn: (...classes: string[]) => classes.filter(Boolean).join(" ") }));
vi.mock("./mcp-code-preview", () => ({ McpCodePreview: ({ value }: { value: string }) => <pre>{value}</pre> }));

const skillCommand = "npx skills add https://github.com/retronew/plane/tree/preview/plugins/plane-workflow/skills";

describe("Skill installation", () => {
  it("offers eight-skill archives for ChatGPT, Codex and generic clients", () => {
    render(<ApiTokenSkillSetup />);
    const skillDownloads = screen.getAllByRole("link", { name: "account_settings.skills.download" });
    expect(skillDownloads).toHaveLength(3);
    for (const link of skillDownloads) {
      expect(link.getAttribute("href")).toBe("/skills/plane-workflow.zip");
    }
    expect(screen.getByRole("link", { name: "account_settings.skills.download_plugin" }).getAttribute("href")).toBe(
      "/skills/plane-workflow-claude.zip"
    );
  });

  it("preserves human ChatGPT instructions and shows the shared skill command", () => {
    render(<ApiTokenSkillSetup />);
    expect(screen.getByText(skillCommand)).toBeTruthy();
    for (const client of ["chatgpt", "generic", "desktop"]) {
      for (const step of [1, 2, 3, 4]) {
        expect(screen.getByText(`account_settings.skills.${client}_step_${step}`)).toBeTruthy();
      }
    }
  });

  it.each(["chatgpt", "codex"] as const)("uses CLI installation and actual host verification for %s", (client) => {
    const prompt = buildSkillAgentPrompt(client, "https://plane.example");
    expect(prompt).toContain("PATH 或宿主明确提供的位置检测官方 codex 可执行文件");
    expect(prompt).toContain("缺少 CLI 时明确停止");
    expect(prompt).toContain("不尝试 ChatGPT 或 Codex desktop UI 自动化");
    expect(prompt).toContain(
      "codex plugin marketplace add retronew/plane --ref preview\ncodex plugin add plane-workflow@plane-openai\ncodex plugin list --marketplace plane-openai"
    );
    expect(prompt).toContain("同一 host 的目标客户端重新加载，实际验证全部 8 个 skills 已加载");
    expect(prompt).toContain("不能承诺 ChatGPT 云端、网页或其他 host 同步");
    expect(prompt).toContain(skillCommand);
    expect(prompt).not.toContain("设置 → 插件");
  });

  it.each(["generic", "codex"] as const)("discovers and installs all eight skills for %s", (client) => {
    const prompt = buildSkillAgentPrompt(client, "https://plane.example");
    expect(prompt).toContain(`${skillCommand} --list`);
    expect(prompt).toContain(`运行 ${skillCommand}，安装全部 8 个 skills`);
    expect(prompt).toContain("让用户选择目标客户端和项目级或全局安装范围");
    expect(prompt).toContain("不默认添加 --global、--agent 或 --yes");
    expect(prompt).toContain("npx skills list --global");
    expect(prompt).toContain("https://plane.example/skills/plane-workflow.zip");
    expect(prompt).not.toContain("--skill plane-workflow");
    expect(prompt).not.toContain("/portable/");
    expect(prompt).not.toContain("/SKILL.md");
  });

  it.each(["claude", "desktop", "chatgpt", "codex", "generic"] as const)(
    "separates skills and manual MCP for %s",
    (client) => {
      const prompt = buildSkillAgentPrompt(client, "https://plane.example");
      expect(prompt).toContain("plugins/plane-workflow/skills");
      expect(prompt).toContain("全部 8 个 skills");
      expect(prompt).toContain("技能安装不等于 MCP 连接");
      expect(prompt).toContain("MCP 由用户独立手动配置");
      expect(prompt).toContain("URL 和个人访问令牌");
      expect(prompt).toContain("不使用 OAuth");
      expect(prompt).toContain("不读取、搜集或回显凭据");
      expect(prompt).toContain('先调用 workspace(action="list")');
      expect(prompt).toContain("仅继承用户已明确的目标 workspace_slug，目标不明确时先询问");
      expect(prompt).toContain("必须显式传入该 workspace_slug，不使用默认工作区或回退目标");
      expect(prompt).not.toContain("plugin configure");
    }
  );

  it("copies the matching client prompt", async () => {
    render(<ApiTokenSkillSetup />);
    fireEvent.click(screen.getByRole("button", { name: "account_settings.skills.agent_prompt_label:ChatGPT" }));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(buildSkillAgentPrompt("chatgpt", window.location.origin))
    );
  });

  it("keeps Claude installation in its own client and sends users to MCP afterward", () => {
    expect(buildSkillAgentPrompt("claude", "https://plane.example")).toContain(
      "claude plugin install plane-workflow@plane-ai"
    );
    const prompt = buildSkillAgentPrompt("desktop", "https://plane.example");
    expect(prompt).toContain("Add from a repository");
    expect(prompt).toContain("https://plane.example/skills/plane-workflow.zip");
    expect(prompt).not.toContain("claude plugin install");
    expect(prompt).toContain("逐个上传或安装全部 8 个 skills");
    expect(prompt).toContain("不假设支持一次上传多技能 ZIP");
  });
});
