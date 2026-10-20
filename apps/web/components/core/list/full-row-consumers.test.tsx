import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { CyclesListItem } from "@/components/cycles/list/cycles-list-item";
import { ModuleListItem } from "@/components/modules/module-list-item";

const mocks = vi.hoisted(() => ({ push: vi.fn(), archived: false }));
vi.mock("next/navigation", () => ({
  useParams: () => ({ workspaceSlug: "workspace", projectId: "project" }),
  usePathname: () => "/workspace/projects/project/modules",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/hooks/use-app-router", () => ({ useAppRouter: () => ({ push: mocks.push }) }));
vi.mock("@/hooks/use-platform-os", () => ({ usePlatformOS: () => ({ isMobile: false }) }));
vi.mock("@plane/i18n", () => ({ translate: (key: string) => key }));
vi.mock("@plane/blocks/layout", () => ({
  Row: ({ children, ...props }: React.ComponentProps<"div">) => <div {...props}>{children}</div>,
  ControlLink: ({ children, disabled: _disabled, ...props }: React.ComponentProps<"a"> & { disabled?: boolean }) => (
    <a
      {...props}
      href={props.href}
      onClick={(event) => {
        event.preventDefault();
        props.onClick?.(event);
      }}
    >
      {children}
    </a>
  ),
}));
vi.mock("@/hooks/store/use-cycle", () => ({
  useCycle: () => ({
    getCycleById: () => ({ id: "cycle", name: "Sprint", status: "draft", archived_at: mocks.archived ? "date" : null }),
  }),
}));
vi.mock("@/hooks/store/use-module", () => ({
  useModule: () => ({
    getModuleById: () => ({
      id: "module",
      name: "Milestone",
      project_id: "project",
      total_issues: 0,
      completed_issues: 0,
      cancelled_issues: 0,
      archived_at: mocks.archived ? "date" : null,
    }),
  }),
}));
vi.mock("@/components/cycles/quick-actions", () => ({ CycleQuickActions: () => null }));
vi.mock("@/components/cycles/list/cycle-list-item-action", () => ({ CycleListItemAction: () => null }));
vi.mock("@/components/modules", () => ({
  ModuleListItemAction: () => null,
  ModuleQuickActions: () => <button onClick={() => mocks.push("module-actions")}>Module actions</button>,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.archived = false;
});

it("stretches the cycle anchor while keeping disclosure above the overlay", () => {
  const toggle = vi.fn();
  render(
    <CyclesListItem
      cycleId="cycle"
      workspaceSlug="workspace"
      projectId="project"
      leadingElement={<button onClick={toggle}>Expand</button>}
    />
  );
  const link = screen.getByRole("link", { name: "Sprint" });
  expect(link.className).toContain("after:inset-0");
  const disclosure = screen.getByRole("button", { name: "Expand" });
  expect(disclosure.parentElement?.className).toContain("z-20");
  expect(link.contains(disclosure)).toBe(false);
  fireEvent.click(disclosure);
  expect(toggle).toHaveBeenCalledOnce();
  expect(mocks.push).not.toHaveBeenCalled();
  fireEvent.click(link);
  expect(mocks.push).toHaveBeenCalledExactlyOnceWith("/workspace/projects/project/cycles/cycle");
});

it("keeps the module actions outside the stretched anchor", () => {
  render(<ModuleListItem moduleId="module" />);
  const link = screen.getByRole("link", { name: /Milestone/ });
  const actions = screen.getByRole("button", { name: "Module actions" });
  expect(link.className).toContain("after:inset-0");
  expect(link.contains(actions)).toBe(false);
  expect(actions.parentElement?.parentElement?.className).toContain("z-20");
  fireEvent.click(actions);
  expect(mocks.push).toHaveBeenCalledExactlyOnceWith("module-actions");
});

it.each(["cycle", "module"])("preserves archived %s overview navigation", (kind) => {
  mocks.archived = true;
  render(
    kind === "cycle" ? (
      <CyclesListItem cycleId="cycle" workspaceSlug="workspace" projectId="project" />
    ) : (
      <ModuleListItem moduleId="module" />
    )
  );
  fireEvent.click(screen.getByRole("link"));
  expect(mocks.push).toHaveBeenCalledExactlyOnceWith(
    `/workspace/projects/project/modules?peek${kind === "cycle" ? "Cycle" : "Module"}=${kind}`
  );
});
