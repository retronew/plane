import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import type { AnalyticsTab } from "@plane/types";
import { describe, expect, it, vi } from "vitest";
import { AnimatedUnderlineTabs } from "@/components/navigation/animated-underline-tabs";
import { AnalyticsToolbar } from "./toolbar";

vi.mock("./analytics-filter-actions", () => ({
  default: () => (
    <div>
      <button>Projects</button>
      <button>Period</button>
    </div>
  ),
}));

const tabs: Pick<AnalyticsTab, "key" | "label" | "isDisabled">[] = [
  { key: "overview", label: "Overview", isDisabled: false },
  { key: "projects", label: "Projects", isDisabled: false },
  { key: "intake", label: "Intake", isDisabled: true },
];

function renderToolbar() {
  return render(
    <MemoryRouter>
      <AnimatedUnderlineTabs value="overview">
        <AnalyticsToolbar workspaceSlug="workspace" tabs={tabs} />
      </AnimatedUnderlineTabs>
    </MemoryRouter>
  );
}

describe("AnalyticsToolbar", () => {
  it("centers actions with symmetric spacing while anchoring the tab underline to the bottom", () => {
    renderToolbar();
    const tabList = screen.getByRole("tablist");
    const tabContainer = tabList.closest(".self-end")!;
    const toolbar = tabContainer.parentElement!;
    const actionContainer = screen.getByRole("button", { name: "Period" }).parentElement!.parentElement!;

    // jsdom has no layout engine: assert the independent alignment constraints.
    expect(toolbar.classList.contains("items-center")).toBe(true);
    expect(toolbar.classList.contains("items-end")).toBe(false);
    expect(toolbar.classList.contains("flex-wrap")).toBe(true);
    expect(tabContainer.classList.contains("self-end")).toBe(true);
    expect(actionContainer.classList.contains("py-2")).toBe(true);
    expect(actionContainer.classList.contains("mb-2")).toBe(false);
  });

  it("preserves real navigation links and disabled tabs", () => {
    renderToolbar();
    expect(screen.getByRole("tab", { name: "Overview" }).getAttribute("href")).toBe("/workspace/analytics/overview/");
    expect(screen.getByRole("tab", { name: "Projects" }).getAttribute("href")).toBe("/workspace/analytics/projects/");
    expect(screen.getByRole("tab", { name: "Intake" }).hasAttribute("href")).toBe(false);
    expect(screen.getByRole("tab", { name: "Intake" }).getAttribute("aria-disabled")).toBe("true");
  });
});
