import { render } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { EUserPermissionsLevel } from "@plane/constants";
import { ProfileIssuesCalendarLayout } from "@/components/issues/issue-layouts/calendar/roots/profile-issues-root";
import { ProfileIssuesSpreadsheetLayout } from "@/components/issues/issue-layouts/spreadsheet/roots/profile-issues-root";
const mock = vi.hoisted(() => ({
  view: "assigned",
  calendar: vi.fn(() => null),
  spreadsheet: vi.fn(() => null),
  allow: vi.fn(
    (_roles: unknown, _level: unknown, _workspace: unknown, project: string) => project === "editable-project"
  ),
}));
vi.hoisted(() => {
  HTMLCanvasElement.prototype.getContext = () => null;
});
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "workspace", profileViewId: mock.view }) }));
vi.mock("@/hooks/store/user", () => ({ useUserPermissions: () => ({ allowPermissions: mock.allow }) }));
vi.mock("@/components/issues/issue-layouts/quick-action-dropdowns", () => ({ ProjectIssueQuickActions: () => null }));
vi.mock("@/components/issues/issue-layouts/calendar/base-calendar-root", () => ({ BaseCalendarRoot: mock.calendar }));
vi.mock("@/components/issues/issue-layouts/spreadsheet/base-spreadsheet-root", () => ({
  BaseSpreadsheetRoot: mock.spreadsheet,
}));
beforeEach(() => {
  vi.clearAllMocks();
  mock.view = "assigned";
});
it.each([ProfileIssuesCalendarLayout, ProfileIssuesSpreadsheetLayout])(
  "forwards the active profile view and checks permissions against each work item's project",
  (Layout) => {
    render(<Layout />);
    const capture = mock.calendar.mock.calls.length ? mock.calendar : mock.spreadsheet;
    const props = (
      capture.mock.calls as unknown as [{ viewId: string; canEditPropertiesBasedOnProject: (id: string) => boolean }][]
    )[0][0];
    expect(props.viewId).toBe("assigned");
    expect(props.canEditPropertiesBasedOnProject("editable-project")).toBe(true);
    expect(props.canEditPropertiesBasedOnProject("private-project")).toBe(false);
    expect(mock.allow).toHaveBeenLastCalledWith(
      expect.any(Array),
      EUserPermissionsLevel.PROJECT,
      "workspace",
      "private-project"
    );
  }
);
