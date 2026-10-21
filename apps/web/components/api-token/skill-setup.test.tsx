import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiTokenSkillSetup, buildSkillAgentPrompt } from "./skill-setup";

const { writeText } = vi.hoisted(() => ({ writeText: vi.fn().mockResolvedValue(undefined) }));
Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, params?: { name?: string; value?: string }) => {
      const param = params?.name ?? params?.value;
      return param ? `${key}:${param}` : key;
    },
  }),
}));
vi.mock("@plane/blocks/toast", () => ({ setToast: vi.fn() }));
vi.mock("@plane/utils", () => ({ cn: (...classes: unknown[]) => classes.filter(Boolean).join(" ") }));

const skillCommand = "npx skills add https://github.com/retronew/plane/tree/preview/plugins/plane-workflow/skills";
const openSection = (title: "agent_title" | "manual_title") =>
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`account_settings\\.skills\\.${title}`) }));
const openClient = (name: string) =>
  fireEvent.click(screen.getByRole("button", { name: `account_settings.skills.view_steps:${name}` }));

describe("Skill installation", () => {
  it("keeps agent and manual setup collapsed by default", () => {
    render(<ApiTokenSkillSetup />);
    expect(screen.getByText("account_settings.skills.connection_hint")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /agent_prompt_label/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /view_steps/ })).toBeNull();
  });

  it("lists an agent prompt for every supported client", async () => {
    render(<ApiTokenSkillSetup />);
    openSection("agent_title");
    await screen.findByRole("button", { name: "account_settings.skills.agent_prompt_label:ChatGPT" });
    for (const name of ["ChatGPT", "Codex", "Claude Desktop", "Claude Code", "GitHub Copilot CLI"])
      expect(screen.getByRole("button", { name: `account_settings.skills.agent_prompt_label:${name}` })).toBeTruthy();
  });

  it("shows manual steps for each plugin client, one client at a time", async () => {
    render(<ApiTokenSkillSetup />);
    openSection("manual_title");
    await screen.findByRole("button", { name: "account_settings.skills.view_steps:ChatGPT" });
    for (const name of ["ChatGPT", "Codex", "Claude Desktop", "Claude Code", "GitHub Copilot CLI", "VS Code"])
      expect(screen.getByRole("button", { name: `account_settings.skills.view_steps:${name}` })).toBeTruthy();
    expect(screen.getAllByText("account_settings.skills.mode_plugin")).toHaveLength(6);
    expect(screen.getByText("account_settings.skills.mode_skills")).toBeTruthy();

    openClient("ChatGPT");
    expect(await screen.findByText("account_settings.skills.chatgpt_step_3")).toBeTruthy();
    expect(screen.getByText("https://github.com/retronew/plane")).toBeTruthy();
    expect(screen.getByText("preview")).toBeTruthy();
    expect(screen.getByText("plane-openai")).toBeTruthy();
    expect(screen.getByText("account_settings.skills.field_branch")).toBeTruthy();
    expect(screen.getByRole("link", { name: "account_settings.skills.download" }).getAttribute("href")).toBe(
      "/skills/plane-workflow.zip"
    );

    openClient("Claude Desktop");
    expect(await screen.findByText("plane-ai")).toBeTruthy();
    await waitFor(() => expect(screen.queryByText("account_settings.skills.chatgpt_step_3")).toBeNull());
    expect(screen.getByRole("link", { name: "account_settings.skills.download_plugin" }).getAttribute("href")).toBe(
      "/skills/plane-workflow-claude.zip"
    );
  });

  it("shows CLI and chat commands for Copilot, VS Code and other clients", async () => {
    render(<ApiTokenSkillSetup />);
    openSection("manual_title");
    openClient("GitHub Copilot CLI");
    expect(await screen.findByText("copilot plugin install plane-workflow@plane-ai")).toBeTruthy();
    openClient("VS Code");
    expect(await screen.findByText("chat.plugins.enabled")).toBeTruthy();
    expect(screen.getByText("/plugin install plane-workflow@plane-ai")).toBeTruthy();
    openClient("account_settings.skills.generic_title");
    expect(await screen.findByText(skillCommand)).toBeTruthy();
  });

  it("copies a single value with its compact copy button", async () => {
    writeText.mockClear();
    render(<ApiTokenSkillSetup />);
    openSection("manual_title");
    openClient("Codex");
    fireEvent.click(
      await screen.findByRole("button", {
        name: "account_settings.skills.copy_value:codex plugin marketplace add retronew/plane --ref preview",
      })
    );
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith("codex plugin marketplace add retronew/plane --ref preview")
    );
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

  it.each(["claude", "desktop", "chatgpt", "codex", "copilot", "generic"] as const)(
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
    openSection("agent_title");
    fireEvent.click(await screen.findByRole("button", { name: "account_settings.skills.agent_prompt_label:ChatGPT" }));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(buildSkillAgentPrompt("chatgpt", window.location.origin))
    );
  });

  it("keeps Claude installation in its own client and sends users to MCP afterward", () => {
    expect(buildSkillAgentPrompt("claude", "https://plane.example")).toContain(
      "claude plugin install plane-workflow@plane-ai"
    );
    const copilot = buildSkillAgentPrompt("copilot", "https://plane.example");
    expect(copilot).toContain(
      "copilot plugin marketplace add retronew/plane\ncopilot plugin install plane-workflow@plane-ai"
    );
    expect(copilot).not.toContain("claude plugin install");
    const prompt = buildSkillAgentPrompt("desktop", "https://plane.example");
    expect(prompt).toContain("Add from a repository");
    expect(prompt).toContain("https://plane.example/skills/plane-workflow.zip");
    expect(prompt).not.toContain("claude plugin install");
    expect(prompt).toContain("逐个上传或安装全部 8 个 skills");
    expect(prompt).toContain("不假设支持一次上传多技能 ZIP");
  });
});
