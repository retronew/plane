import type { ReactNode } from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { SortableChange } from "@plane/blocks/sortable";
import { ProjectLinkList } from "./links";

const mocks = vi.hoisted(() => ({
  reorder: vi.fn(),
  toast: vi.fn(),
  ids: ["a", "b"],
  saving: {} as Record<string, boolean>,
  onSortEndCallback: undefined as undefined | ((change: SortableChange) => Promise<void>),
}));
vi.mock("@/hooks/store/use-home", () => ({
  useHome: () => ({
    quickLinks: {
      getLinksByWorkspaceId: () => mocks.ids,
      reorderLink: mocks.reorder,
      isReorderingLinks: mocks.saving,
    },
  }),
}));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@plane/blocks/toast", () => ({ setToast: mocks.toast }));
vi.mock("@plane/blocks/sortable", () => ({
  SortableProvider: ({
    children,
    disabled,
    onSortEnd,
  }: {
    children: ReactNode;
    disabled: boolean;
    onSortEnd: typeof mocks.onSortEndCallback;
  }) => {
    mocks.onSortEndCallback = onSortEnd;
    return (
      <div data-testid="provider" data-disabled={disabled}>
        {children}
      </div>
    );
  },
  SortableItem: ({
    id,
    index,
    group,
    activation,
    disabled,
    children,
  }: {
    id: string;
    index: number;
    group: string;
    activation: string;
    disabled: boolean;
    children: (props: { handleRef: () => void }) => ReactNode;
  }) => (
    <div data-testid={id} data-index={index} data-group={group} data-activation={activation} data-disabled={disabled}>
      {children({ handleRef: () => {} })}
    </div>
  ),
}));
vi.mock("@/components/core/content-overflow-HOC", () => ({
  ContentOverflowWrapper: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("./link-detail", () => ({
  ProjectLinkDetail: ({ linkId, sortableRef }: { linkId: string; sortableRef: () => void }) => (
    <button ref={sortableRef}>{linkId}</button>
  ),
}));
vi.mock("../empty-states/links", () => ({ LinksEmptyState: () => <div>Empty</div> }));
vi.mock("../loaders", () => ({ EWidgetKeys: { QUICK_LINKS: "links" }, WidgetLoader: () => <div>Loading</div> }));
const operations = { update: vi.fn(), remove: vi.fn() } as never;
const change = { id: "a", initialIndex: 0, index: 1, initialGroup: "quick-links:w", group: "quick-links:w" };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.saving = {};
  mocks.ids = ["a", "b"];
  mocks.reorder.mockResolvedValue(undefined);
});
afterEach(cleanup);

it("renders row onSortEndCallbacking in a workspace group and persists final index without editing", async () => {
  render(<ProjectLinkList workspaceSlug="w" linkOperations={operations} />);
  expect(screen.getByTestId("a").dataset).toMatchObject({ index: "0", group: "quick-links:w", activation: "row" });
  await mocks.onSortEndCallback!(change);
  expect(mocks.reorder).toHaveBeenCalledWith("w", "a", 1);
  expect(mocks.toast).not.toHaveBeenCalled();
  await mocks.onSortEndCallback!({ ...change, group: "quick-links:other" });
  expect(mocks.reorder).toHaveBeenCalledOnce();
});

it("disables provider and every card during persistence", () => {
  mocks.saving.w = true;
  render(<ProjectLinkList workspaceSlug="w" linkOperations={operations} />);
  expect(screen.getByTestId("provider").dataset.disabled).toBe("true");
  expect(screen.getByTestId("a").dataset.disabled).toBe("true");
  expect(screen.getByTestId("b").dataset.disabled).toBe("true");
});

it("reports persistence failure and rethrows so sortable aborts the visual move", async () => {
  mocks.reorder.mockRejectedValueOnce(new Error("offline"));
  render(<ProjectLinkList workspaceSlug="w" linkOperations={operations} />);
  await expect(mocks.onSortEndCallback!(change)).rejects.toThrow("offline");
  expect(mocks.toast).toHaveBeenCalledWith({ type: "error", title: "error", message: "something_went_wrong" });
});
