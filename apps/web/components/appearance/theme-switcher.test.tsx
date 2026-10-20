import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeSwitcher } from "./theme-switcher";

const state = vi.hoisted(() => ({
  savedTheme: undefined as string | undefined,
  theme: undefined as string | undefined,
}));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("next-themes", () => ({ useTheme: () => ({ theme: state.theme, setTheme: vi.fn() }) }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@plane/blocks/toast", () => ({ setPromiseToast: vi.fn() }));
vi.mock("@plane/utils", () => ({ applyCustomTheme: vi.fn() }));
vi.mock("@/hooks/store/user", () => ({
  useUserProfile: () => ({ data: { theme: { theme: state.savedTheme } }, updateUserTheme: vi.fn() }),
}));
vi.mock("@/components/core/theme/custom-theme-selector", () => ({ CustomThemeSelector: () => null }));
vi.mock("@/components/core/theme/theme-switch", () => ({
  ThemeSwitch: ({ value }: { value: { value: string } | null }) => <output>{value?.value ?? "empty"}</output>,
}));
vi.mock("@/components/settings/control-item", () => ({
  SettingsControlItem: ({ control }: { control: React.ReactNode }) => <div>{control}</div>,
}));

afterEach(cleanup);
beforeEach(() => {
  state.savedTheme = undefined;
  state.theme = undefined;
});

describe("theme selection defaults", () => {
  it("selects system for a new user before theme hydration", () => {
    render(<ThemeSwitcher option={{ id: "theme", title: "theme", description: "theme" }} />);
    expect(screen.getByRole("status").textContent).toBe("system");
  });

  it("uses the active local theme when no preference has been saved", () => {
    state.theme = "dark";
    render(<ThemeSwitcher option={{ id: "theme", title: "theme", description: "theme" }} />);
    expect(screen.getByRole("status").textContent).toBe("dark");
  });

  it("prefers the saved user theme", () => {
    state.savedTheme = "light";
    state.theme = "dark";
    render(<ThemeSwitcher option={{ id: "theme", title: "theme", description: "theme" }} />);
    expect(screen.getByRole("status").textContent).toBe("light");
  });

  it("falls back to system for an unsupported stored value", () => {
    state.savedTheme = "obsolete";
    render(<ThemeSwitcher option={{ id: "theme", title: "theme", description: "theme" }} />);
    expect(screen.getByRole("status").textContent).toBe("system");
  });
});
