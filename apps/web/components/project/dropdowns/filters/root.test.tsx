import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { Menu, MenuContent, MenuTrigger } from "@makeplane/propel/components/menu";
import { setLanguage } from "@plane/i18n";
import { ProjectFiltersSelection } from "./root";
vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "test" }) }));
vi.mock("@/hooks/store/use-member", () => ({ useMember: () => ({ getUserDetails: vi.fn() }) }));
vi.mock("@/components/settings/workspace/configuration/project-fields", () => ({
  useProjectCategories: () => ({ statesEnabled: false, statuses: [], labels: [] }),
}));
vi.mock("@/components/core/filters/date-filter-modal", () => ({ DateFilterModal: () => null }));
beforeEach(async () => {
  await setLanguage("zh-CN");
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  Element.prototype.getAnimations ??= () => [];
});
afterEach(async () => {
  await setLanguage("en");
  vi.unstubAllGlobals();
});
it("keeps all priority glyphs and selection actions in the shared project and archive filter menu", async () => {
  const change = vi.fn();
  render(
    <Menu defaultOpen>
      <MenuTrigger render={<button type="button">Filters</button>} />
      <MenuContent>
        <ProjectFiltersSelection
          displayFilters={{ layout: "gallery" }}
          filters={{ priority: [] }}
          handleFiltersUpdate={change}
          handleDisplayFiltersUpdate={vi.fn()}
        />
      </MenuContent>
    </Menu>
  );
  const topLevelItems = await Promise.all(
    ["可见性", "优先级", "项目标签", "负责人", "成员", "创建日期"].map((name) =>
      screen.findByRole("menuitem", { name })
    )
  );
  for (const item of topLevelItems) {
    expect(item.querySelector("svg.lucide")).not.toBeNull();
  }
  fireEvent.click(await screen.findByRole("menuitem", { name: "优先级" }));
  const items = await Promise.all(
    ["紧急", "高", "中", "低", "无"].map((name) => screen.findByRole("menuitemcheckbox", { name }))
  );
  for (const item of items) {
    expect(item.querySelector('svg[class*="text-priority-"]')).not.toBeNull();
  }
  fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "高" }));
  expect(change).toHaveBeenCalledWith("priority", "high");
});
