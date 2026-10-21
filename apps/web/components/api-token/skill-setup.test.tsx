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

describe("Skill installation", () => {
  it("provides separate ChatGPT and Codex fallback downloads", () => {
    render(<ApiTokenSkillSetup />);
    expect(screen.getByRole("link", { name: "account_settings.skills.download:ChatGPT" }).getAttribute("href")).toBe(
      "/skills/plane-workflow.zip"
    );
    expect(screen.getByRole("link", { name: "account_settings.skills.download:Codex" }).getAttribute("href")).toBe(
      "/skills/plane-workflow/SKILL.md"
    );
  });
  it("offers a Desktop plugin archive and a marketplace-first agent prompt", async () => {
    render(<ApiTokenSkillSetup />);
    expect(
      screen.getByRole("link", { name: "account_settings.skills.download:Claude Desktop" }).getAttribute("href")
    ).toBe("/skills/plane-workflow-claude.zip");
    fireEvent.click(screen.getByRole("button", { name: "account_settings.skills.agent_prompt_label:Claude Desktop" }));
    const prompt = buildSkillAgentPrompt("desktop", window.location.origin);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(prompt));
    expect(prompt).toContain("Add from a repository");
    expect(prompt).toContain("plane-ai");
    expect(prompt).not.toContain("claude plugin install");
  });
  it("copies the matching marketplace prompt", async () => {
    render(<ApiTokenSkillSetup />);
    fireEvent.click(screen.getByRole("button", { name: "account_settings.skills.agent_prompt_label:Codex" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(buildSkillAgentPrompt("codex", window.location.origin)));
  });
  it("shows the GitHub skill command, four steps and Markdown fallback", () => {
    render(<ApiTokenSkillSetup />);
    expect(
      screen.getByText(
        "npx skills add https://github.com/retronew/plane/tree/preview/plugins/plane-workflow/portable/plane-workflow --skill plane-workflow"
      )
    ).toBeTruthy();
    for (const step of [1, 2, 3, 4]) {
      expect(screen.getByText(`account_settings.skills.generic_step_${step}`)).toBeTruthy();
    }
    expect(
      screen
        .getByRole("link", { name: "account_settings.skills.download:account_settings.skills.generic_title" })
        .getAttribute("href")
    ).toBe("/skills/plane-workflow/SKILL.md");
  });
  it("copies a generic prompt that checks discovery before interactive installation", async () => {
    render(<ApiTokenSkillSetup />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "account_settings.skills.agent_prompt_label:account_settings.skills.generic_title",
      })
    );
    const prompt = buildSkillAgentPrompt("generic", window.location.origin);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(prompt));
    const command =
      "npx skills add https://github.com/retronew/plane/tree/preview/plugins/plane-workflow/portable/plane-workflow --skill plane-workflow";
    expect(prompt).toContain(`${command} --list`);
    expect(prompt.indexOf(`${command} --list`)).toBeLessThan(prompt.indexOf(`运行 ${command}，`));
    expect(prompt).toContain("让用户选择目标客户端和项目级或全局安装范围");
    expect(prompt).toContain("不默认添加 --global、--agent 或 --yes");
    expect(prompt).toContain("npx skills list --global");
    expect(prompt).toContain("MCP 独立配置");
    expect(prompt).toContain(`${window.location.origin}/skills/plane-workflow/SKILL.md`);
  });
  it("provides the verified Codex plugin add command after checking CLI support", () => {
    render(<ApiTokenSkillSetup />);
    expect(
      screen.getByText(
        "codex plugin marketplace add retronew/plane --ref preview codex plugin add plane-workflow@plane-openai"
      )
    ).toBeTruthy();
    const prompt = buildSkillAgentPrompt("codex", "https://plane.example");
    expect(prompt).toContain("codex plugin add --help");
    expect(prompt).toContain("codex plugin add plane-workflow@plane-openai");
    expect(prompt).toContain("市场注册不等于插件已安装");
  });
  it("distinguishes marketplace registration, installation and authentication", () => {
    const prompt = buildSkillAgentPrompt("chatgpt", "https://plane.example");
    expect(prompt).toContain("右上角添加 → 添加插件市场");
    expect(prompt).toContain("分支或版本字段填 preview");
    expect(prompt).toContain("不要进入 Admin Console");
    expect(prompt).toContain("bearer_token_env_var");
    expect(prompt).toContain("https://plane.example/skills/plane-workflow.zip");
    expect(prompt).not.toContain("codex plugin install");
    expect(buildSkillAgentPrompt("claude", "https://plane.example")).toContain(
      "claude plugin install plane-workflow@plane-ai"
    );
  });
});
