import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { IssueActivityBlockComponent } from "./activity-block";
import { ActivityDisplayContext, IntakeActivityContext } from "../../../intake-activity-context";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const data = vi.hoisted(() => ({
  field: "name",
  verb: "updated",
  actor: { id: "member", display_name: "Full Member Name", avatar_url: "", is_bot: false } as
    | { id: string; display_name: string; avatar_url: string; is_bot: boolean }
    | undefined,
}));
vi.mock("@/hooks/store/use-issue-detail", () => ({
  useIssueDetail: () => ({
    activity: {
      getActivityById: () => ({
        actor_detail: data.actor,
        field: data.field,
        verb: data.verb,
        created_at: new Date().toISOString(),
        workspace_detail: { slug: "workspace" },
      }),
    },
  }),
}));
vi.mock("@/hooks/store/use-member", () => ({ useMember: () => ({ getUserDetails: () => undefined }) }));
vi.mock("@/hooks/use-platform-os", () => ({ usePlatformOS: () => ({ isMobile: false }) }));

beforeEach(() => {
  data.field = "name";
  data.verb = "updated";
  data.actor = { id: "member", display_name: "Full Member Name", avatar_url: "", is_bot: false };
});

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
it("keeps the avatar outside the wrapping message in the detail activity row", () => {
  render(
    <ActivityDisplayContext.Provider value>
      <IssueActivityBlockComponent activityId="activity" ends="top">
        a long activity message that may wrap
      </IssueActivityBlockComponent>
    </ActivityDisplayContext.Provider>
  );
  const avatar = screen.getByRole("img", { name: "Full Member Name" }).closest("a")!;
  const message = screen.getByText("Full Member Name").closest("[data-activity-message]")!;
  expect(avatar.parentElement).toBe(message.parentElement);
  expect(message.contains(avatar)).toBe(false);
  expect(message.textContent).toContain("a long activity message");
});
it.each(["updated", "created"])("keeps the %s actor and inline status in the same wrapping text flow", (verb) => {
  data.verb = verb;
  data.field = verb === "created" ? "" : "state";
  render(
    <ActivityDisplayContext.Provider value>
      <IssueActivityBlockComponent activityId="activity" ends={undefined}>
        changed status to <span className="inline-flex items-center align-middle">In progress</span>
      </IssueActivityBlockComponent>
    </ActivityDisplayContext.Provider>
  );
  const actor = screen.getByText("Full Member Name");
  const message = actor.closest("[data-activity-message]")!;
  const avatar = screen.getByRole("img", { name: "Full Member Name" }).closest("a")!;
  expect(message.contains(screen.getByText("In progress"))).toBe(true);
  expect(actor.tagName).toBe("A");
  expect(message.className).toContain("leading-7");
  expect(message.className).toContain("[overflow-wrap:anywhere]");
  expect(message.className.split(" ")).not.toEqual(
    expect.arrayContaining([expect.stringMatching(/^(flex|inline-flex|truncate|whitespace-nowrap|py-1\.5)$/)])
  );
  expect(avatar.parentElement).toBe(message.parentElement);
  expect(avatar.className).toContain("h-7");
  expect(avatar.className).toContain("items-center");
  expect(avatar.className).toContain("shrink-0");
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
