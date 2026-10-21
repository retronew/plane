import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  GROUPED_PROFILE_SETTINGS,
  PROFILE_SETTINGS,
  PROFILE_SETTINGS_CATEGORY,
  PROFILE_SETTINGS_TABS,
} from "@plane/constants";
import { getProfileSettingsTab } from "@/helpers/profile-settings";
import { PROFILE_SETTINGS_PAGES_MAP } from ".";
import { SkillsProfileSettings } from "./skills";

const state = vi.hoisted(() => ({ toggle: vi.fn() }));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/store/use-command-palette", () => ({
  useCommandPalette: () => ({ toggleProfileSettingsModal: state.toggle }),
}));
vi.mock("@/components/api-token/skill-setup", () => ({ ApiTokenSkillSetup: () => <div>Skills setup</div> }));
vi.mock("@/components/settings/profile/heading", () => ({
  ProfileSettingsHeading: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
vi.mock("@makeplane/propel/components/button", () => ({
  Button: ({ label, onClick }: { label: string; onClick: () => void }) => <button onClick={onClick}>{label}</button>,
}));

describe("Skills personal settings", () => {
  it("renders the standalone skill setup and switches to MCP through the settings store", () => {
    render(<SkillsProfileSettings />);
    expect(screen.getByRole("heading", { name: "account_settings.skills.title" })).toBeTruthy();
    expect(screen.getByText("Skills setup")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "account_settings.skills.configure_mcp" }));
    expect(state.toggle).toHaveBeenCalledWith({ activeTab: "mcp", isOpen: true });
  });

  it("registers skills as its own developer tab with a page and route validation", () => {
    expect(PROFILE_SETTINGS.skills).toEqual({ key: "skills", i18n_label: "account_settings.skills.title" });
    expect(PROFILE_SETTINGS_TABS).toContain("skills");
    expect(GROUPED_PROFILE_SETTINGS[PROFILE_SETTINGS_CATEGORY.DEVELOPER].map(({ key }) => key)).toEqual([
      "api-tokens",
      "mcp",
      "skills",
    ]);
    expect(getProfileSettingsTab("skills")).toBe("skills");
    expect(Object.keys(PROFILE_SETTINGS_PAGES_MAP)).toHaveLength(PROFILE_SETTINGS_TABS.length);
    expect(Object.keys(PROFILE_SETTINGS_PAGES_MAP)).toEqual(expect.arrayContaining([...PROFILE_SETTINGS_TABS]));
    expect(PROFILE_SETTINGS_PAGES_MAP.skills).not.toBe(PROFILE_SETTINGS_PAGES_MAP.mcp);
  });
});
