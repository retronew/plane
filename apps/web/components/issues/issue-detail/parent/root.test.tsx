import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { TIssue } from "@plane/types";
import type { TIssueOperations } from "../root";
import { IssueParentDetail } from "./root";

const state = vi.hoisted(() => ({ redirect: vi.fn() }));
const parent = { id: "parent", project_id: "project", sequence_id: 46, name: "Long parent title ".repeat(10) };
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/store/use-issues", () => ({ useIssues: () => ({ issueMap: { parent } }) }));
vi.mock("@/hooks/store/use-project", () => ({ useProject: () => ({ getProjectIdentifierById: () => "FS" }) }));
vi.mock("@/hooks/use-platform-os", () => ({ usePlatformOS: () => ({ isMobile: false }) }));
vi.mock("@/hooks/use-issue-peek-overview-redirection", () => ({
  default: () => ({ handleRedirection: state.redirect }),
}));
vi.mock("./siblings", () => ({ IssueParentSiblings: () => null }));

it("shows the parent relationship and full title in a bounded link without nested buttons", () => {
  const { container } = render(
    <IssueParentDetail
      workspaceSlug="workspace"
      projectId="project"
      issueId="child"
      issue={{ parent_id: "parent" } as TIssue}
      issueOperations={{ update: vi.fn() } as unknown as TIssueOperations}
    />
  );
  const link = screen.getByRole("link");
  expect(screen.getByText("common.parent")).toBeTruthy();
  expect(screen.getByText(parent.name.trim()).textContent).toBe(parent.name);
  expect(link.className).toContain("min-w-0");
  expect(screen.getByText(parent.name.trim()).className).toContain("truncate");
  expect(link.querySelector("button")).toBeNull();
  expect(container.querySelector("[data-parent-issue]")?.className).not.toContain("mb-5");
  fireEvent.click(link);
  expect(state.redirect).toHaveBeenCalledWith("workspace", parent, false);
});
