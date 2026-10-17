import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { IssueActivityBlockComponent } from "./activity-block";
import { IntakeActivityContext } from "../../../intake-activity-context";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const data = vi.hoisted(() => ({
  actor: { id: "member", display_name: "Full Member Name", avatar_url: "", is_bot: false } as
    | { id: string; display_name: string; avatar_url: string; is_bot: boolean }
    | undefined,
}));
vi.mock("@/hooks/store/use-issue-detail", () => ({
  useIssueDetail: () => ({
    activity: {
      getActivityById: () => ({
        actor_detail: data.actor,
        field: "name",
        created_at: new Date().toISOString(),
        workspace_detail: { slug: "workspace" },
      }),
    },
  }),
}));
vi.mock("@/hooks/store/use-member", () => ({ useMember: () => ({ getUserDetails: () => undefined }) }));
vi.mock("@/hooks/use-platform-os", () => ({ usePlatformOS: () => ({ isMobile: false }) }));
vi.mock("@/components/common/activity/activity-sentence", () => ({
  ActivitySentence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

it("shows the real actor avatar and full-name tooltip on the profile link in Intake", async () => {
  render(
    <IntakeActivityContext.Provider value>
      <IssueActivityBlockComponent activityId="activity" ends="top">
        renamed title
      </IssueActivityBlockComponent>
    </IntakeActivityContext.Provider>
  );
  const link = screen.getByText("Full Member Name").closest("a")!;
  expect(link.getAttribute("href")).toBe("/workspace/profile/member");
  expect(screen.getByRole("img", { name: "Full Member Name" })).toBeTruthy();
  fireEvent.mouseEnter(link.parentElement!);
  fireEvent.focus(link);
  expect(await screen.findByRole("tooltip")).toHaveProperty("textContent", "Full Member Name");
});
it("preserves normal activity without the Intake avatar", () => {
  render(
    <IssueActivityBlockComponent activityId="activity" ends="top">
      renamed title
    </IssueActivityBlockComponent>
  );
  expect(screen.queryByRole("img", { name: "Full Member Name" })).toBeNull();
});
it("does not invent an actor avatar for missing identity", () => {
  data.actor = undefined;
  render(
    <IntakeActivityContext.Provider value>
      <IssueActivityBlockComponent activityId="activity" ends="top">
        system update
      </IssueActivityBlockComponent>
    </IntakeActivityContext.Provider>
  );
  expect(screen.queryByRole("img")).toBeNull();
});
