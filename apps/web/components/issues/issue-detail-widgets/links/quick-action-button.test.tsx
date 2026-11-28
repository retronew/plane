import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { EIssueServiceType } from "@plane/types";
import { IssueLinksActionButton } from "./quick-action-button";

const mocks = vi.hoisted(() => ({ toggleIssueLinkModal: vi.fn() }));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@plane/i18n", () => ({ translate: (key: string) => key }));
vi.mock("@/hooks/store/use-issue-detail", () => ({
  useIssueDetail: () => ({ toggleIssueLinkModal: mocks.toggleIssueLinkModal }),
}));

beforeEach(() => {
  mocks.toggleIssueLinkModal.mockReset();
});

it("renders the supplied customButton directly without nesting buttons", () => {
  const parent = vi.fn();
  const { container, rerender } = render(
    <div onClick={parent} onKeyDown={parent} role="presentation">
      <IssueLinksActionButton
        issueServiceType={EIssueServiceType.ISSUES}
        customButton={<button type="button">Add link</button>}
      />
    </div>
  );

  const button = screen.getByRole("button", { name: "Add link" });
  expect(container.querySelectorAll("button")).toHaveLength(1);
  expect(button.querySelector("button")).toBeNull();

  fireEvent.click(button);
  expect(mocks.toggleIssueLinkModal).toHaveBeenCalledWith(true);
  expect(parent).not.toHaveBeenCalled();

  rerender(
    <IssueLinksActionButton
      issueServiceType={EIssueServiceType.ISSUES}
      disabled
      customButton={<button type="button">Add link</button>}
    />
  );
  fireEvent.click(screen.getByRole("button", { name: "Add link" }));
  expect(mocks.toggleIssueLinkModal).toHaveBeenCalledTimes(1);
});

it("renders an accessible trailing IconButton when no customButton is passed", () => {
  render(<IssueLinksActionButton issueServiceType={EIssueServiceType.ISSUES} />);
  const button = screen.getByRole("button", { name: "issue.add.link" });
  fireEvent.click(button);
  expect(mocks.toggleIssueLinkModal).toHaveBeenCalledExactlyOnceWith(true);
});
