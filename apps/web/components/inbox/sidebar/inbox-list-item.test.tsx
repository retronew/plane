import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { expect, it, vi } from "vitest";
import { InboxIssueListItem } from "./inbox-list-item";

const mocks = vi.hoisted(() => ({
  closeSidebar: vi.fn(),
  labelIds: [] as string[],
  getIssueInboxByIssueId: (id: string) => ({
    status: -2,
    issue: {
      id,
      name: `Issue ${id}`,
      sequence_id: id === "first" ? 1 : 2,
      priority: "high",
      label_ids: mocks.labelIds,
    },
  }),
}));
vi.mock("@/hooks/store/use-project-inbox", () => ({
  useProjectInbox: () => ({ currentTab: "open", getIssueInboxByIssueId: mocks.getIssueInboxByIssueId }),
}));
vi.mock("@/hooks/store/use-label", () => ({
  useLabel: () => ({ projectLabels: [{ id: "label", name: "Design", color: "#ff0000" }] }),
}));
vi.mock("@/hooks/store/use-member", () => ({ useMember: () => ({ getUserDetails: () => undefined }) }));
vi.mock("@/hooks/use-platform-os", () => ({ usePlatformOS: () => ({ isMobile: false }) }));
vi.mock("@/components/dropdowns/member/avatar", () => ({ ButtonAvatars: () => null }));
vi.mock("../inbox-issue-status", () => ({ InboxIssueStatus: () => null }));
vi.mock("@plane/i18n", () => ({ translate: (key: string) => key }));

function Location() {
  return <output aria-label="Current location">{useLocation().search}</output>;
}

it("keeps one current link and moves the current item when another intake item is opened", () => {
  mocks.closeSidebar.mockClear();
  render(
    <MemoryRouter initialEntries={["/workspace/projects/project/intake?currentTab=open&inboxIssueId=first"]}>
      {["first", "second"].map((id) => (
        <InboxIssueListItem
          key={id}
          workspaceSlug="workspace"
          projectId="project"
          projectIdentifier="INT"
          inboxIssueId={id}
          setIsMobileSidebar={mocks.closeSidebar}
        />
      ))}
      <Location />
    </MemoryRouter>
  );

  const first = screen.getByRole("link", { name: /Issue first/ });
  const second = screen.getByRole("link", { name: /Issue second/ });
  expect(first.textContent).toContain("high");
  expect(first.getAttribute("aria-current")).toBe("true");
  expect(second.hasAttribute("aria-current")).toBe(false);
  first.focus();
  expect(document.activeElement).toBe(first);

  fireEvent.click(first);
  expect(screen.getByLabelText("Current location").textContent).toContain("inboxIssueId=first");
  fireEvent.click(second);
  expect(screen.getByLabelText("Current location").textContent).toContain("inboxIssueId=second");
  expect(second.getAttribute("aria-current")).toBe("true");
  expect(first.hasAttribute("aria-current")).toBe(false);
  expect(mocks.closeSidebar).toHaveBeenCalledTimes(2);
  expect(mocks.closeSidebar).toHaveBeenLastCalledWith(false);
});

it("renders known labels, skips missing labels and summarizes more than three", () => {
  const item = (
    <MemoryRouter>
      <InboxIssueListItem
        workspaceSlug="workspace"
        projectId="project"
        inboxIssueId="first"
        setIsMobileSidebar={mocks.closeSidebar}
      />
    </MemoryRouter>
  );
  mocks.labelIds = ["label", "missing"];
  const view = render(item);
  expect(screen.getByText("Design")).toBeTruthy();
  expect(screen.queryByText("missing")).toBeNull();
  view.unmount();
  mocks.labelIds = ["label", "second", "third", "fourth"];
  render(item);
  expect(screen.queryByText("Design")).toBeNull();
  expect(screen.getByText("web.runtime.labels_count")).toBeTruthy();
  mocks.labelIds = [];
});
