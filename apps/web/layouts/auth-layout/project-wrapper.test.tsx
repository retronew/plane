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
  fetchProjectDetails: vi.fn().mockResolvedValue({ id: "p1" }),
  fetchUserProjectInfo: vi.fn().mockResolvedValue({}),
  fetchProjectUserProperties: vi.fn().mockResolvedValue({}),
  fetchProjectLabels: vi.fn().mockResolvedValue([]),
  fetchProjectMembers: vi.fn().mockResolvedValue([]),
  fetchProjectStates: vi.fn().mockResolvedValue([]),
  fetchProjectIntakeState: vi.fn().mockResolvedValue({}),
  getProjectEstimates: vi.fn().mockResolvedValue([]),
  fetchAllCycles: vi.fn().mockResolvedValue([]),
  fetchModules: vi.fn().mockResolvedValue([]),
  fetchModulesSlim: vi.fn().mockResolvedValue([]),
  fetchViews: vi.fn().mockResolvedValue([]),
  initGantt: vi.fn(),
}));

vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname }));
vi.mock("@/components/auth-screens/project/project-access-restriction", () => ({
  ProjectAccessRestriction: () => <div>restricted</div>,
}));
vi.mock("@/hooks/store/estimates", () => ({
  useProjectEstimates: () => ({ getProjectEstimates: mocks.getProjectEstimates }),
}));
vi.mock("@/hooks/store/use-cycle", () => ({ useCycle: () => ({ fetchAllCycles: mocks.fetchAllCycles }) }));
vi.mock("@/hooks/store/use-label", () => ({ useLabel: () => ({ fetchProjectLabels: mocks.fetchProjectLabels }) }));
vi.mock("@/hooks/store/use-member", () => ({
  useMember: () => ({
    project: {
      fetchProjectMembers: mocks.fetchProjectMembers,
      fetchProjectUserProperties: mocks.fetchProjectUserProperties,
    },
  }),
}));
vi.mock("@/hooks/store/use-module", () => ({
  useModule: () => ({ fetchModules: mocks.fetchModules, fetchModulesSlim: mocks.fetchModulesSlim }),
}));
vi.mock("@/hooks/store/use-project", () => ({
  useProject: () => ({
    fetchProjectDetails: mocks.fetchProjectDetails,
    getProjectById: () => mocks.projectDetails,
  }),
}));
vi.mock("@/hooks/store/use-project-state", () => ({
  useProjectState: () => ({
    fetchProjectStates: mocks.fetchProjectStates,
    fetchProjectIntakeState: mocks.fetchProjectIntakeState,
  }),
}));
vi.mock("@/hooks/store/use-project-view", () => ({ useProjectView: () => ({ fetchViews: mocks.fetchViews }) }));
vi.mock("@/hooks/store/user", () => ({
  useUser: () => ({ data: { id: "u1" } }),
  useUserPermissions: () => ({
    fetchUserProjectInfo: mocks.fetchUserProjectInfo,
    allowPermissions: () => mocks.hasPermission,
    getProjectRoleByWorkspaceSlugAndProjectId: () => mocks.role,
    joinProject: vi.fn().mockResolvedValue(undefined),
  }),
}));
vi.mock("@/hooks/use-timeline-chart", () => ({ useTimeLineChart: () => ({ initGantt: mocks.initGantt }) }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.pathname = "/ws/projects/p1/issues/";
  mocks.role = undefined;
  mocks.hasPermission = true;
  mocks.projectDetails = undefined;
});

it("waits for project role and details before fetching sub-resources and skips disabled features", () => {
  const wrap = () => (
    <SWRConfig value={{ provider: () => new Map() }}>
      <ProjectAuthWrapper workspaceSlug="ws" projectId="p1">
        <div>ok</div>
      </ProjectAuthWrapper>
    </SWRConfig>
  );

  const { rerender } = render(wrap());
  expect(mocks.fetchProjectDetails).toHaveBeenCalledTimes(1);
  expect(mocks.fetchUserProjectInfo).toHaveBeenCalledTimes(1);
  expect(mocks.fetchProjectLabels).not.toHaveBeenCalled();
  expect(mocks.fetchProjectMembers).not.toHaveBeenCalled();
  expect(mocks.fetchProjectStates).not.toHaveBeenCalled();
  expect(mocks.fetchModules).not.toHaveBeenCalled();
  expect(mocks.fetchModulesSlim).not.toHaveBeenCalled();

  // Role ready but projectDetails still undefined: feature-flagged endpoints must NOT fire prematurely
  mocks.role = EUserPermissions.ADMIN;
  rerender(
    <ProjectAuthWrapper workspaceSlug="ws" projectId="p1">
      <div>ok</div>
    </ProjectAuthWrapper>
  );
  expect(mocks.fetchProjectIntakeState).not.toHaveBeenCalled();
  expect(mocks.getProjectEstimates).not.toHaveBeenCalled();
  expect(mocks.fetchAllCycles).not.toHaveBeenCalled();
  expect(mocks.fetchModules).not.toHaveBeenCalled();
  expect(mocks.fetchViews).not.toHaveBeenCalled();

  mocks.projectDetails = {
    id: "p1",
    inbox_view: false,
    estimate: null,
    cycle_view: false,
    module_view: true,
    issue_views_view: true,
  };
  rerender(
    <ProjectAuthWrapper workspaceSlug="ws" projectId="p1">
      <div>ok</div>
    </ProjectAuthWrapper>
  );

  expect(mocks.fetchProjectLabels).toHaveBeenCalledTimes(1);
  expect(mocks.fetchProjectMembers).toHaveBeenCalledTimes(1);
  expect(mocks.fetchProjectStates).toHaveBeenCalledTimes(1);
  expect(mocks.fetchProjectUserProperties).toHaveBeenCalledTimes(1);
  expect(mocks.fetchModules).toHaveBeenCalledTimes(1);
  expect(mocks.fetchModulesSlim).not.toHaveBeenCalled();
  expect(mocks.fetchProjectIntakeState).not.toHaveBeenCalled();
  expect(mocks.getProjectEstimates).not.toHaveBeenCalled();
  expect(mocks.fetchAllCycles).not.toHaveBeenCalled();
  expect(mocks.fetchViews).not.toHaveBeenCalled();
});

it("skips unrelated sub-resources on project settings and pages routes", () => {
  mocks.pathname = "/ws/settings/projects/p1/";
  mocks.role = EUserPermissions.ADMIN;
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

  expect(mocks.fetchProjectDetails).toHaveBeenCalledTimes(1);
  expect(mocks.fetchUserProjectInfo).not.toHaveBeenCalled();
  expect(mocks.fetchAllCycles).not.toHaveBeenCalled();
  expect(mocks.fetchModules).not.toHaveBeenCalled();
  expect(mocks.fetchViews).not.toHaveBeenCalled();
  expect(mocks.fetchProjectIntakeState).not.toHaveBeenCalled();
  expect(mocks.fetchProjectUserProperties).not.toHaveBeenCalled();
  expect(mocks.initGantt).not.toHaveBeenCalled();
});
