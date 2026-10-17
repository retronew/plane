import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EUserPermissions } from "@plane/constants";
import { EUserProjectRoles, type IWorkspaceMember } from "@plane/types";
import { AccountTypeColumn as ProjectRoleColumn } from "@/components/project/settings/member-columns";
import { AccountTypeColumn, NameColumn } from "./member-columns";

const mocks = vi.hoisted(() => ({
  currentUserId: "viewer",
  isWorkspaceAdmin: true,
  currentProjectRole: 20,
  workspaceRoles: {} as Record<string, number>,
  updateMember: vi.fn(),
  updateMemberRole: vi.fn(),
}));
vi.mock("@/hooks/store/user", () => ({
  useUser: () => ({ data: { id: mocks.currentUserId } }),
  useUserPermissions: () => ({
    allowPermissions: () => mocks.isWorkspaceAdmin,
    getProjectRoleByWorkspaceSlugAndProjectId: () => mocks.currentProjectRole,
  }),
}));
vi.mock("@/hooks/store/use-member", () => ({
  useMember: () => ({
    workspace: {
      updateMember: mocks.updateMember,
      getWorkspaceMemberDetails: (id: string) => ({ role: mocks.workspaceRoles[id] ?? EUserPermissions.MEMBER }),
    },
    project: { updateMemberRole: mocks.updateMemberRole },
  }),
}));
vi.mock("@plane/i18n", () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@plane/blocks/toast", () => ({ setToast: vi.fn() }));

function makeMember(overrides: Partial<IWorkspaceMember> = {}): IWorkspaceMember {
  const user = {
    id: "member",
    first_name: "Alex",
    last_name: "Chen",
    display_name: "alex",
    email: "alex@example.com",
    avatar_url: "",
    is_bot: false,
  };
  return { ...user, member: user, role: EUserPermissions.MEMBER, ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.currentUserId = "viewer";
  mocks.isWorkspaceAdmin = true;
  mocks.currentProjectRole = EUserPermissions.ADMIN;
  mocks.workspaceRoles = { viewer: EUserPermissions.ADMIN };
});

describe("workspace member name", () => {
  it.each([
    [{}, "Alex Chen"],
    [{ first_name: "", last_name: "" }, "alex"],
    [{ first_name: "", last_name: "", display_name: "" }, "alex@example.com"],
  ])("links the name to the profile with fallback %j", (overrides, label) => {
    render(
      <MemoryRouter>
        <NameColumn
          rowData={{ member: makeMember(overrides), role: EUserPermissions.MEMBER, is_active: true }}
          workspaceSlug="workspace"
          isAdmin={false}
          currentUser={undefined}
          setRemoveMemberModal={vi.fn()}
        />
      </MemoryRouter>
    );
    expect(screen.getByRole("link", { name: label }).getAttribute("href")).toBe("/workspace/profile/member/");
  });

  it("keeps suspended members unlinked and without actions", () => {
    render(
      <MemoryRouter>
        <NameColumn
          rowData={{ member: makeMember(), role: EUserPermissions.MEMBER, is_active: false }}
          workspaceSlug="workspace"
          isAdmin
          currentUser={undefined}
          setRemoveMemberModal={vi.fn()}
        />
      </MemoryRouter>
    );
    expect(screen.getByText("Alex Chen")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("workspace member role", () => {
  it("shows the current administrator as a disabled dropdown without opening or updating", async () => {
    render(
      <AccountTypeColumn
        rowData={{ member: makeMember({ id: "viewer" }), role: EUserPermissions.ADMIN, is_active: true }}
        workspaceSlug="workspace"
      />
    );
    const trigger = screen.getByRole("button") as HTMLButtonElement;
    expect(trigger.disabled).toBe(true);
    expect(trigger.getAttribute("aria-haspopup")).toBe("listbox");
    expect(trigger.querySelector("svg")).toBeTruthy();
    fireEvent.click(trigger);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(mocks.updateMember).not.toHaveBeenCalled();
    fireEvent.focus(trigger.parentElement!);
    expect((await screen.findByRole("tooltip")).textContent).toBe("web.member_management.own_workspace_role_readonly");
  });

  it.each([true, false])("only lets administrators edit other members (admin=%s)", async (isAdmin) => {
    mocks.isWorkspaceAdmin = isAdmin;
    render(
      <AccountTypeColumn
        rowData={{ member: makeMember(), role: EUserPermissions.MEMBER, is_active: true }}
        workspaceSlug="workspace"
      />
    );
    const trigger = screen.getByRole("button") as HTMLButtonElement;
    expect(trigger.disabled).toBe(!isAdmin);
    fireEvent.focus(trigger.parentElement!);
    if (!isAdmin) {
      expect((await screen.findByRole("tooltip")).textContent).toBe(
        "web.member_management.workspace_role_admin_required"
      );
    } else {
      expect(screen.queryByRole("tooltip")).toBeNull();
    }
  });

  it("preserves the suspended badge without a role control", () => {
    render(
      <AccountTypeColumn
        rowData={{ member: makeMember(), role: EUserPermissions.MEMBER, is_active: false }}
        workspaceSlug="workspace"
      />
    );
    expect(screen.getByText("web.suspended")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("project member role", () => {
  it.each([
    {
      viewer: EUserPermissions.ADMIN,
      target: EUserPermissions.ADMIN,
      self: true,
      project: EUserPermissions.ADMIN,
      editable: true,
    },
    {
      viewer: EUserPermissions.MEMBER,
      target: EUserPermissions.MEMBER,
      self: true,
      project: EUserPermissions.ADMIN,
      editable: false,
    },
    {
      viewer: EUserPermissions.MEMBER,
      target: EUserPermissions.MEMBER,
      self: false,
      project: EUserPermissions.ADMIN,
      editable: true,
    },
    {
      viewer: EUserPermissions.MEMBER,
      target: EUserPermissions.ADMIN,
      self: false,
      project: EUserPermissions.ADMIN,
      editable: false,
    },
    {
      viewer: EUserPermissions.MEMBER,
      target: EUserPermissions.MEMBER,
      self: false,
      project: EUserPermissions.MEMBER,
      editable: false,
    },
  ])("preserves the project permission policy: %j", async ({ viewer, target, self, project, editable }) => {
    const memberId = self ? "viewer" : "member";
    mocks.workspaceRoles = { viewer, [memberId]: target };
    mocks.currentProjectRole = project;
    render(
      <ProjectRoleColumn
        rowData={{ member: makeMember({ id: memberId }), original_role: EUserProjectRoles.ADMIN }}
        workspaceSlug="workspace"
        projectId="project"
        currentProjectRole={project}
      />
    );
    const trigger = screen.getByRole("button") as HTMLButtonElement;
    expect(trigger.disabled).toBe(!editable);
    expect(trigger.getAttribute("aria-haspopup")).toBe("listbox");
    if (!editable) {
      fireEvent.click(trigger);
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(mocks.updateMemberRole).not.toHaveBeenCalled();
      fireEvent.focus(trigger.parentElement!);
      const reason = self
        ? "web.member_management.own_project_role_readonly"
        : project === EUserPermissions.ADMIN
          ? "web.member_management.workspace_admin_project_role_readonly"
          : "web.member_management.project_role_admin_required";
      expect((await screen.findByRole("tooltip")).textContent).toBe(reason);
    } else {
      fireEvent.focus(trigger.parentElement!);
      expect(screen.queryByRole("tooltip")).toBeNull();
    }
  });
});
