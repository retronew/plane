import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TopNavPowerK } from "./top-nav-power-k";

const { setActivePage, setTopNavInputRef } = vi.hoisted(() => ({ setActivePage: vi.fn(), setTopNavInputRef: vi.fn() }));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("next/navigation", () => ({ useParams: () => ({}) }));
vi.mock("@plane/i18n", () => ({ translate: (key: string) => key }));
vi.mock("@/hooks/use-app-router", () => ({ useAppRouter: () => ({}) }));
vi.mock("@/hooks/store/use-power-k", () => ({
  usePowerK: () => ({ setActivePage, setTopNavInputRef, activePage: null }),
}));
vi.mock("@/hooks/store/user", () => ({ useUser: () => ({ data: { id: "user" } }) }));
vi.mock("@/hooks/store/use-issue-detail", () => ({
  useIssueDetail: () => ({ issue: { getIssueById: vi.fn(), getIssueIdByIdentifier: vi.fn() } }),
}));
vi.mock("@/components/power-k/ui/modal/commands-list", () => ({ ProjectsAppPowerKCommandsList: () => null }));
vi.mock("@/components/power-k/ui/modal/footer", () => ({ PowerKModalFooter: () => null }));

describe("TopNavPowerK input entry", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("opens on input focus, closes with Escape, and clears while returning focus", () => {
    render(<TopNavPowerK />);
    const input = screen.getByRole("textbox", { name: "web.search_commands" });
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );
    act(() => input.focus());
    expect(input.closest(".top-nav-command-search")?.getAttribute("data-open")).toBe("true");
    expect(input.closest("label")).not.toBeNull();
    fireEvent.change(input, { target: { value: "test" } });
    const clear = screen.getByRole("button", { name: "power_k.search_menu.clear_search" });
    expect(input.closest("label")?.contains(clear)).toBe(false);
    clear.focus();
    fireEvent.click(clear);
    expect((input as HTMLInputElement).value).toBe("");
    expect(document.activeElement).toBe(input);
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input.closest(".top-nav-command-search")?.hasAttribute("data-open")).toBe(false);
    expect(document.activeElement).not.toBe(input);
    fireEvent.mouseDown(input);
    expect(input.closest(".top-nav-command-search")?.getAttribute("data-open")).toBe("true");
  });
});
