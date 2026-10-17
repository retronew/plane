import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { EUserPermissions } from "@plane/constants";
import type { IInboxIssueStore } from "@/store/inbox/inbox-issue.store";
import { InboxIssueActionsHeader } from "./inbox-issue-header";

const mocks = vi.hoisted(() => ({
  role: 20,
  creator: "someone-else",
  deleteInboxIssue: vi.fn(),
  push: vi.fn(),
}));
vi.mock("@/hooks/store/use-project-inbox", () => ({
  useProjectInbox: () => ({
    currentTab: "pending",
    filteredInboxIssueIds: ["issue"],
    deleteInboxIssue: mocks.deleteInboxIssue,
  }),
}));
vi.mock("@/hooks/store/user", () => ({
  useUser: () => ({ data: { id: "me" } }),
  useUserPermissions: () => ({ allowPermissions: (roles: number[]) => roles.includes(mocks.role) }),
}));
vi.mock("@/hooks/store/use-project", () => ({
  useProject: () => ({
    getPartialProjectById: () => ({ identifier: "INT" }),
    getProjectById: () => ({ identifier: "INT" }),
    getProjectIdentifierById: () => "INT",
  }),
}));
vi.mock("@/hooks/use-app-router", () => ({ useAppRouter: () => ({ push: mocks.push }) }));
vi.mock("@/components/issues/issue-modal/modal", () => ({ CreateUpdateIssueModal: () => null }));
vi.mock("@/components/issues/issue-update-status", () => ({ NameDescriptionUpdateStatus: () => null }));
vi.mock("../modals/decline-issue-modal", () => ({ DeclineIssueModal: () => null }));
vi.mock("../modals/select-duplicate", () => ({ SelectDuplicateInboxIssueModal: () => null }));
vi.mock("../modals/snooze-issue-modal", () => ({ InboxIssueSnoozeModal: () => null }));
vi.mock("../modals/delete-issue-modal", () => ({
  DeleteInboxIssueModal: ({ isOpen, onSubmit }: { isOpen: boolean; onSubmit: () => void }) =>
    isOpen ? (
      <dialog open>
        <button onClick={onSubmit}>Confirm delete</button>
      </dialog>
    ) : null,
}));
vi.mock("@plane/i18n", () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.role = EUserPermissions.ADMIN;
  mocks.creator = "someone-else";
  mocks.deleteInboxIssue.mockResolvedValue(undefined);
  Element.prototype.getAnimations ??= () => [];
});

function mount(status = -2) {
  const inboxIssue = {
    status,
    issue: { id: "issue", project_id: "project", sequence_id: 1, created_by: mocks.creator },
  } as IInboxIssueStore;
  return render(
    <InboxIssueActionsHeader
      workspaceSlug="workspace"
      projectId="project"
      inboxIssue={inboxIssue}
      isSubmitting="saved"
      isMobileSidebar={false}
      setIsMobileSidebar={() => {}}
      isNotificationEmbed={false}
    />
  );
}

async function openMenu(mobile: boolean) {
  const buttons = screen.getAllByRole("button", { name: "aria_labels.common.more_actions" });
  fireEvent.click(buttons[mobile ? buttons.length - 1 : 0]);
  return screen.findByRole("menu");
}

for (const mobile of [false, true]) {
  it(`places a red delete row in the final separate group (${mobile ? "mobile" : "desktop"})`, async () => {
    mount();
    const menu = await openMenu(mobile);
    const items = within(menu).getAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual(
      mobile
        ? ["web.snooze", "web.mark_as_duplicate", "web.accept", "web.decline", "web.delete"]
        : [
            "inbox_issue.actions.snooze",
            "inbox_issue.actions.mark_as_duplicate",
            "inbox_issue.actions.copy",
            "inbox_issue.actions.delete",
          ]
    );
    const deletion = items.at(-1)!;
    expect(within(menu).getAllByRole("separator")).toHaveLength(1);
    expect(deletion.previousElementSibling).toBe(within(menu).getByRole("separator"));
    expect(deletion.classList.contains("text-danger-primary")).toBe(true);
    expect(deletion.querySelector("svg")).not.toBeNull();
    fireEvent.click(deletion);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(mocks.deleteInboxIssue).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));
    expect(mocks.deleteInboxIssue).toHaveBeenCalledWith("workspace", "project", "issue");
  });

  it(`hides delete and its separator for a member who is not the creator (${mobile ? "mobile" : "desktop"})`, async () => {
    mocks.role = EUserPermissions.MEMBER;
    mount();
    const menu = await openMenu(mobile);
    expect(within(menu).queryByRole("menuitem", { name: /delete/ })).toBeNull();
    expect(within(menu).queryByRole("separator")).toBeNull();
  });

  it(`preserves delete permission for the member who created the issue (${mobile ? "mobile" : "desktop"})`, async () => {
    mocks.role = EUserPermissions.MEMBER;
    mocks.creator = "me";
    mount();
    const menu = await openMenu(mobile);
    expect(within(menu).getByRole("menuitem", { name: /delete/ })).toBeTruthy();
    expect(within(menu).getByRole("separator")).toBeTruthy();
  });
}

it.each([-1, 1, 2])("keeps deletion unavailable for resolved status %s", async (status) => {
  mount(status);
  const menu = await openMenu(true);
  expect(within(menu).queryByRole("menuitem", { name: /delete/ })).toBeNull();
  expect(within(menu).queryByRole("separator")).toBeNull();
});

it("preserves the desktop menu permission gate for guests", () => {
  mocks.role = EUserPermissions.GUEST;
  mount();
  // Only the pre-existing mobile menu is rendered for guests.
  expect(screen.getAllByRole("button", { name: "aria_labels.common.more_actions" })).toHaveLength(1);
});
