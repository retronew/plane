import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { TSelectionHelper } from "@/hooks/use-multiple-select";
import { HeaderGroupByCard } from "./group-by-card";
vi.hoisted(() => {
  HTMLCanvasElement.prototype.getContext = () => null;
});
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "workspace" }) }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/use-issue-layout-store", () => ({ useIssueStoreType: () => "PROFILE" }));
vi.mock("@/components/core/modals/existing-issues-list-modal", () => ({ ExistingIssuesListModal: () => null }));
vi.mock("@/components/core/multiple-select", () => ({ MultipleSelectGroupAction: () => null }));
vi.mock("@/components/epic-modal", () => ({ CreateUpdateEpicModal: () => null }));
vi.mock("@/components/issues/issue-modal/modal", () => ({
  CreateUpdateIssueModal: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <p>Create work item</p> : null),
}));
it("makes the icon and title one accessible toggle while keeping Add independent", () => {
  const toggle = vi.fn();
  render(
    <HeaderGroupByCard
      groupID="urgent"
      groupBy="priority"
      title="紧急"
      count={1}
      icon={<span data-testid="priority-icon">!</span>}
      isExpanded
      issuePayload={{ priority: "urgent" }}
      canEditProperties={() => false}
      selectionHelpers={{ isGroupSelected: () => "empty", isSelectionDisabled: true } as unknown as TSelectionHelper}
      handleCollapsedGroups={toggle}
    />
  );
  expect(screen.getByRole("button", { name: /紧急/ }).getAttribute("aria-expanded")).toBe("true");
  fireEvent.click(screen.getByTestId("priority-icon"));
  expect(toggle).toHaveBeenCalledExactlyOnceWith("urgent");
  fireEvent.click(screen.getByRole("button", { name: "common.add" }));
  expect(screen.getByText("Create work item")).toBeTruthy();
  expect(toggle).toHaveBeenCalledTimes(1);
});
