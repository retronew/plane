import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectMemberList } from "./member-list";

const mocks = vi.hoisted(() => ({
  allMemberIds: ["alex", "sam", "guest"] as string[] | null,
  filteredMemberIds: ["alex"] as string[] | null,
  getProjectMemberIds: vi.fn(),
}));
vi.mock("@/hooks/store/use-member", () => ({
  useMember: () => ({
    project: {
      projectMemberIds: mocks.filteredMemberIds,
      getProjectMemberIds: mocks.getProjectMemberIds,
      getFilteredProjectMemberDetails: () => ({
        member: { first_name: "Alex", last_name: "Chen", display_name: "alex" },
        original_role: 15,
      }),
      filters: { getFilters: () => ({ roles: ["15"] }) },
    },
  }),
}));
vi.mock("@/hooks/store/user", () => ({ useUserPermissions: () => ({ allowPermissions: () => false }) }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("./dropdowns/filters/member-list", () => ({ MemberListFiltersDropdown: () => null }));
vi.mock("./member-list-item", () => ({ ProjectMemberListItem: () => <div>member rows</div> }));
vi.mock("./send-project-invitation-modal", () => ({ SendProjectInvitationModal: () => null }));
vi.mock("@/components/ui/loader/settings/members", () => ({ MembersSettingsLoader: () => <div>loading members</div> }));

beforeEach(() => {
  mocks.allMemberIds = ["alex", "sam", "guest"];
  mocks.filteredMemberIds = ["alex"];
  mocks.getProjectMemberIds.mockReset().mockImplementation(() => mocks.allMemberIds);
});

describe("project member count", () => {
  it("includes guests and keeps the total when role filtering or searching hides rows", () => {
    render(<ProjectMemberList projectId="project" workspaceSlug="workspace" />);
    expect(mocks.getProjectMemberIds).toHaveBeenCalledWith("project", true);
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("member rows")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "web.search" }));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "no matching name" } });
    expect(screen.getByText("no_matching_members")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
  });

  it("shows zero once an empty member list is loaded", () => {
    mocks.allMemberIds = [];
    mocks.filteredMemberIds = [];
    render(<ProjectMemberList projectId="project" workspaceSlug="workspace" />);
    expect(screen.getByText("0")).toBeTruthy();
  });

  it("does not present a zero count while members are loading", () => {
    mocks.allMemberIds = null;
    mocks.filteredMemberIds = null;
    render(<ProjectMemberList projectId="project" workspaceSlug="workspace" />);
    expect(screen.getByText("loading members")).toBeTruthy();
    expect(screen.queryByText("0")).toBeNull();
  });
});
