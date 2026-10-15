import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { TWorkspaceBaseActivity } from "@plane/types";
import { ActivityBlockComponent } from "./activity-block";
import { IssueActivityBlockComponent } from "@/components/issues/issue-detail/issue-activity/activity/actions/helpers/activity-block";
import { LabelActivityChip } from "@/components/issues/issue-detail/issue-activity/activity/actions/label-activity-chip";
const activity = {
  id: "activity",
  field: "state",
  created_at: new Date("2026-10-14T10:00:00Z"),
} as unknown as TWorkspaceBaseActivity;
vi.mock("./user", () => ({ User: () => <a href="/profile/actor">Actor</a> }));
vi.mock("@/hooks/use-platform-os", () => ({ usePlatformOS: () => ({ isMobile: false }) }));
vi.mock("@/hooks/store/use-issue-detail", () => ({
  useIssueDetail: () => ({ activity: { getActivityById: () => activity } }),
}));
vi.mock("@/components/issues/issue-detail/issue-activity/activity/actions/helpers/issue-user", () => ({
  IssueUser: () => <a href="/profile/actor">Actor</a>,
}));
vi.mock("@/components/issues/issue-detail/issue-activity/activity/actions/helpers/issue-creator", () => ({
  IssueCreatorDisplay: () => null,
}));
it.each(["project", "issue"])(
  "keeps the %s activity timestamp outside the sentence without dropping its links",
  (kind) => {
    const message = (
      <>
        Changed{" "}
        <a data-activity-part="" href="/issue/1">
          QA-1
        </a>{" "}
        to <span data-activity-part="">Done</span>
      </>
    );
    const { container } = render(
      kind === "project" ? (
        <ActivityBlockComponent activity={activity} ends={undefined}>
          {message}
        </ActivityBlockComponent>
      ) : (
        <IssueActivityBlockComponent activityId="activity" ends={undefined}>
          {message}
        </IssueActivityBlockComponent>
      )
    );
    expect(screen.getByRole("link", { name: "QA-1" }).getAttribute("href")).toBe("/issue/1");
    expect(container.querySelectorAll("[data-activity-part]")).toHaveLength(2);
    const timestamp = container.querySelector("[data-base-ui-tooltip-trigger]");
    expect(timestamp).toBeTruthy();
    expect(timestamp?.closest("div")?.contains(screen.getByRole("link", { name: "QA-1" }))).toBe(false);
  }
);
it.each([undefined, "", "   "])("does not invent or reserve a label color for %j", (color) => {
  const { container } = render(<LabelActivityChip name="Design" color={color} />);
  expect(screen.getByText("Design")).toBeTruthy();
  expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
});
it("retains a label's actual color", () => {
  const { container } = render(<LabelActivityChip name="Design" color="red" />);
  expect(container.querySelector<HTMLElement>('[aria-hidden="true"]')?.style.backgroundColor).toBe("red");
});
