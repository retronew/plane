import { render } from "@testing-library/react";
import { SWRConfig } from "swr";
import { beforeEach, expect, it, vi } from "vitest";
import { EUserPermissions } from "@plane/constants";
import { ProjectAuthWrapper } from "./project-wrapper";

const mocks = vi.hoisted(() => ({
  pathname: "/ws/projects/p1/issues/",
  role: undefined as EUserPermissions | undefined,
  hasPermission: true,
  projectDetails: undefined as
    | {
        id: string;
        inbox_view?: boolean;
        estimate?: string | null;
        cycle_view?: boolean;
        module_view?: boolean;
        issue_views_view?: boolean;
      }
    | undefined,
  getProjectBootstrap: vi.fn().mockResolvedValue({
    project: { id: "p1" },
    project_member_me: { role: 20 },
    states: [],
    labels: [],
    members: [],
    user_properties: null,
    cycles: null,
    modules: null,
    views: null,
    estimates: null,
  }),
  fetchProjectIntakeState: vi.fn().mockResolvedValue({}),
  initGantt: vi.fn(),
}));

vi.mock("mobx-react", () => ({ observer: (component: unknown) => component, enableStaticRendering: vi.fn() }));
vi.mock("@/lib/store-context", () => ({
  StoreContext: { Provider: ({ children }: { children: unknown }) => children },
}));
vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname }));
vi.mock("@/components/auth-screens/project/project-access-restriction", () => ({
  ProjectAccessRestriction: () => <div>restricted</div>,
}));
vi.mock("@/services/bootstrap.service", () => ({
  bootstrapService: { getProjectBootstrap: mocks.getProjectBootstrap },
}));
vi.mock("@/lib/bootstrap-cache", () => ({
  hydrateProjectBootstrap: vi.fn(),
}));
vi.mock("@/hooks/store/use-project", () => ({
  useProject: () => ({
    getProjectById: () => mocks.projectDetails,
  }),
}));
vi.mock("@/hooks/store/use-project-state", () => ({
  useProjectState: () => ({
    fetchProjectIntakeState: mocks.fetchProjectIntakeState,
  }),
}));
vi.mock("@/hooks/store/user", () => ({
  useUser: () => ({ data: { id: "u1" } }),
  useUserPermissions: () => ({
    allowPermissions: () => mocks.hasPermission,
    getProjectRoleByWorkspaceSlugAndProjectId: () => mocks.role,
    joinProject: vi.fn().mockResolvedValue(undefined),
  }),
}));
vi.mock("@/hooks/use-timeline-chart", () => ({ useTimeLineChart: () => ({ initGantt: mocks.initGantt }) }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.pathname = "/ws/projects/p1/issues/";
  mocks.role = EUserPermissions.ADMIN;
  mocks.hasPermission = true;
  mocks.projectDetails = {
    id: "p1",
    inbox_view: false,
    estimate: null,
    cycle_view: false,
    module_view: true,
    issue_views_view: true,
  };
});

it("aggregates project shell fetches into a single route-scoped bootstrap call and skips disabled features", () => {
  render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <ProjectAuthWrapper workspaceSlug="ws" projectId="p1">
        <div>ok</div>
      </ProjectAuthWrapper>
    </SWRConfig>
  );

  expect(mocks.getProjectBootstrap).toHaveBeenCalledTimes(1);
  const [slug, pid, includes] = mocks.getProjectBootstrap.mock.calls[0];
  expect(slug).toBe("ws");
  expect(pid).toBe("p1");
  expect(includes).toContain("states");
  expect(includes).toContain("labels");
  expect(includes).toContain("members");
  expect(includes).toContain("user_properties");
  expect(includes).toContain("modules");
  expect(includes).not.toContain("cycles");
  expect(includes).not.toContain("estimates");
  expect(includes).not.toContain("views");
  expect(mocks.fetchProjectIntakeState).not.toHaveBeenCalled();
});

it("omits unrelated sub-resources on project settings routes and skips initGantt", () => {
  mocks.pathname = "/ws/settings/projects/p1/";
  mocks.projectDetails = {
    id: "p1",
    inbox_view: true,
    estimate: "est-1",
    cycle_view: true,
    module_view: true,
    issue_views_view: true,
  };

  render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <ProjectAuthWrapper workspaceSlug="ws" projectId="p1">
        <div>ok</div>
      </ProjectAuthWrapper>
    </SWRConfig>
  );

  expect(mocks.getProjectBootstrap).toHaveBeenCalledTimes(1);
  const [, , includes] = mocks.getProjectBootstrap.mock.calls[0];
  expect(includes).toEqual([]);
  expect(mocks.fetchProjectIntakeState).not.toHaveBeenCalled();
  expect(mocks.initGantt).not.toHaveBeenCalled();
});
