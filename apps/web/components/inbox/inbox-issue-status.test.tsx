import { render } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { EInboxIssueStatus } from "@plane/types";
import type { IInboxIssueStore } from "@/store/inbox/inbox-issue.store";
import { InboxIssueStatus } from "./inbox-issue-status";
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
it("uses the reference badge dimensions for accepted intake", () => {
  const { container } = render(
    <InboxIssueStatus inboxIssue={{ status: EInboxIssueStatus.ACCEPTED } as IInboxIssueStore} />
  );
  expect(container.firstElementChild?.className).toContain("min-h-6");
  expect(container.firstElementChild?.className).toContain("rounded-md");
  expect(container.querySelector("svg")?.classList.contains("!size-3.5")).toBe(true);
  expect(container.querySelector(".whitespace-nowrap")?.className).toContain("text-body-xs-medium");
});
it("preserves pending typography and radius", () => {
  const { container } = render(
    <InboxIssueStatus inboxIssue={{ status: EInboxIssueStatus.PENDING } as IInboxIssueStore} />
  );
  expect(container.firstElementChild?.className).toContain("rounded-md");
  expect(container.querySelector(".whitespace-nowrap")?.className).toContain("text-body-xs-medium");
  expect(container.querySelector("svg")?.classList.contains("!size-3.5")).toBe(false);
});
