import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiTokenSkillSetup, buildSkillAgentPrompt } from "./skill-setup";

vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@plane/blocks/toast", () => ({ setToast: vi.fn() }));
vi.mock("@plane/utils", () => ({ cn: (...classes: unknown[]) => classes.filter(Boolean).join(" ") }));

describe("Standalone skills", () => {
  it("offers a skills command and ZIP without plugin installation", () => {
    render(<ApiTokenSkillSetup />);
    expect(
      (screen.getByRole("textbox", { name: "account_settings.skills.manual_title" }) as HTMLTextAreaElement).value
    ).toContain("npx skills add");
    expect(screen.getByRole("button", { name: "account_settings.mcp.copy_config" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "account_settings.skills.download" }).getAttribute("href")).toBe(
      "/skills/plane-workflow.zip"
    );
    expect(screen.queryByText(/plugin install/)).toBeNull();
  });
  it.each(["claude", "desktop", "chatgpt", "codex", "copilot", "generic"] as const)(
    "installs skills independently for %s",
    (client) => {
      const prompt = buildSkillAgentPrompt(client, "https://plane.example");
      expect(prompt).toContain("--list");
      expect(prompt).toContain("全部 8 个 skills");
      expect(prompt).toContain("https://plane.example/skills/plane-workflow.zip");
      expect(prompt).not.toContain("plugin install");
      expect(prompt).not.toContain("OAuth");
    }
  );
});
