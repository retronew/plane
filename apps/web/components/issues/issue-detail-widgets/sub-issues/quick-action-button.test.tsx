import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { EIssueServiceType } from "@plane/types";
import { SubIssuesActionButton } from "./quick-action-button";
const state = vi.hoisted(() => ({ typeId: "task" as string | null, enabled: true, loaded: true }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/store/use-issue-detail", () => ({
  useIssueDetail: () => ({
    issue: { getIssueById: () => ({ id: "i", project_id: "p", type_id: state.typeId }) },
    toggleCreateIssueModal: vi.fn(),
    toggleSubIssuesModal: vi.fn(),
    setIssueCrudOperationState: vi.fn(),
    issueCrudOperationState: { create: { toggle: false }, existing: { toggle: false } },
  }),
}));
vi.mock("@/hooks/use-issue-hierarchy", () => ({
  useIssueHierarchy: () => ({
    data: state.loaded
      ? {
          enabled: state.enabled,
          issue_types: [
            { id: "task", level: 0, is_default: true, is_active: true },
            { id: "epic", level: 2, is_active: true },
          ],
        }
      : undefined,
  }),
}));
vi.mock("@plane/blocks/common", () => ({
  ActionMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@makeplane/propel/components/menu", () => ({
  Menu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  MenuTrigger: ({
    children,
    disabled,
    "aria-disabled": ariaDisabled,
  }: {
    children: ReactNode;
    disabled: boolean;
    "aria-disabled"?: boolean;
  }) => (
    <button disabled={disabled} aria-disabled={ariaDisabled} aria-label="trigger">
      {children}
    </button>
  ),
  MenuItem: ({ label, disabled, description }: { label: string; disabled?: boolean; description?: string }) => (
    <button disabled={disabled}>
      {label}
      {description}
    </button>
  ),
}));
beforeEach(() => {
  state.typeId = "task";
  state.enabled = true;
  state.loaded = true;
});
it("disables adding children at level zero with an explanation", () => {
  render(<SubIssuesActionButton issueId="i" issueServiceType={EIssueServiceType.ISSUES} />);
  expect((screen.getByLabelText("trigger") as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText("web.issue_hierarchy.leaf_no_children")).toBeTruthy();
  expect(screen.getByLabelText("trigger").getAttribute("aria-disabled")).toBe("true");
});
it("preserves ordinary nesting when hierarchy is disabled", () => {
  state.enabled = false;
  render(<SubIssuesActionButton issueId="i" issueServiceType={EIssueServiceType.ISSUES} />);
  expect((screen.getByLabelText("trigger") as HTMLButtonElement).disabled).toBe(false);
});
it("does not mistake loading or an unknown type for level zero", () => {
  state.typeId = "unknown";
  render(<SubIssuesActionButton issueId="i" issueServiceType={EIssueServiceType.ISSUES} />);
  expect((screen.getByLabelText("trigger") as HTMLButtonElement).disabled).toBe(false);
  expect(screen.queryByText("web.issue_hierarchy.leaf_no_children")).toBeNull();
});
it("disables creation when the next level has no active type", () => {
  state.typeId = "epic";
  render(<SubIssuesActionButton issueId="i" issueServiceType={EIssueServiceType.ISSUES} />);
  expect((screen.getByText(/common.create_new/).closest("button") as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByText("common.add_existing") as HTMLButtonElement).disabled).toBe(false);
});
