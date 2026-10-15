import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { IProject } from "@plane/types";
import { ProjectCardProperties } from "./card-properties";
import { ProjectStatusSelect } from "../settings/workspace/configuration/project-status-select";

const mocks = vi.hoisted(() => ({ save: vi.fn(), toast: vi.fn() }));
vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "workspace" }) }));
vi.mock("@plane/i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@plane/i18n")>()),
  useTranslation: () => ({
    currentLocale: "en",
    t: (key: string) =>
      (
        ({
          lead: "Lead",
          labels: "Labels",
          date: "Date",
          high: "High",
          none: "None",
          "common.priority": "Priority",
          "web.runtime.date_range_placeholder": "Date range",
        }) as Record<string, string>
      )[key] ?? key,
  }),
  getCurrentLanguage: () => "en",
}));
vi.mock("@/hooks/store/use-project", () => ({ useProject: () => ({ updateProject: mocks.save }) }));
vi.mock("@/hooks/store/user", () => ({
  useUserProfile: () => ({ data: { start_of_the_week: 1 } }),
  useUser: () => ({ data: { id: "current" } }),
}));
vi.mock("@/hooks/store/use-member", () => ({
  useMember: () => ({
    getUserDetails: () => ({ id: "ada", display_name: "Ada", first_name: "Ada", last_name: "", avatar_url: "" }),
    workspace: { workspaceMemberIds: ["ada"], isUserSuspended: () => false },
    project: { getProjectMemberIds: () => ["ada"], fetchProjectMembers: vi.fn() },
  }),
}));
vi.mock("@plane/blocks/toast", () => ({ setToast: mocks.toast }));
vi.mock("@/components/settings/workspace/configuration/project-fields", () => ({
  useProjectCategories: () => ({
    labels: [{ id: "backend", name: "Backend", color: "#123456" }],
    statuses: [
      { id: "draft", name: "Draft", group: "draft", is_default: true },
      { id: "active", name: "Active", group: "execution" },
    ],
    statesEnabled: true,
  }),
}));
const project = {
  id: "project",
  priority: "high",
  project_lead: "ada",
  labels: ["backend"],
  start_date: "2026-10-15",
  target_date: "2026-10-20",
} as IProject;
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 15, 12));
  mocks.save.mockResolvedValue(undefined);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, get: () => 240 });
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", { configurable: true, get: () => 256 });
  Object.defineProperty(Element.prototype, "clientHeight", { configurable: true, get: () => 240 });
  Object.defineProperty(Element.prototype, "getAnimations", { configurable: true, value: () => [] });
});

afterEach(() => vi.useRealTimers());

it("renders selected labels, the actual lead avatar and compact dates instead of generic icons", () => {
  render(<ProjectCardProperties project={project} disabled={false} />);
  expect(screen.getByRole("button", { name: "Priority, High" }).textContent).toBe("High");
  expect(screen.getByRole("button", { name: "Labels, Backend" }).textContent).toBe("Backend");
  expect(screen.getByRole("button", { name: "Lead, Ada" }).textContent).toContain("A");
  expect(screen.getByRole("button", { name: "10/15–20" })).toBeTruthy();
});

it.each([
  ["2026-10-30", "2026-11-02", "10/30–11/02"],
  ["2026-12-31", "2027-01-02", "2026/12/31–2027/01/02"],
  [null, "2026-10-20", "10/20"],
  ["2026-10-15", null, "10/15"],
])("keeps partial and cross-month/year date ranges accurate (%s, %s)", (start_date, target_date, label) => {
  render(<ProjectCardProperties project={{ ...project, start_date, target_date } as IProject} disabled={false} />);
  expect(screen.getByRole("button", { name: label })).toBeTruthy();
});

it("preserves the full lead name and date label in the wrapping board layout", () => {
  render(<ProjectCardProperties project={project} disabled={false} wrap />);
  expect(screen.getByRole("button", { name: "Lead, Ada" }).textContent).toContain("Ada");
  expect(screen.getByRole("button", { name: /Oct 15 - 20, 2026/ })).toBeTruthy();
});

it("keeps status editing functional and prevents clicks from opening the project", async () => {
  const navigate = vi.fn();
  render(
    <a href="/project" onClick={navigate}>
      <ProjectStatusSelect workspaceSlug="workspace" projectId="project" value="draft" />
    </a>
  );
  fireEvent.click(screen.getByRole("button", { name: "Draft" }));
  fireEvent.click(await screen.findByRole("option", { name: "Active" }));
  await waitFor(() => expect(mocks.save).toHaveBeenCalledWith("workspace", "project", { status: "active" }));
  expect(navigate).not.toHaveBeenCalled();
});

it("opens the actual label picker and saves its selection without project navigation", async () => {
  const navigate = vi.fn();
  render(
    <a href="/project" onClick={navigate}>
      <ProjectCardProperties project={project} disabled={false} />
    </a>
  );
  fireEvent.click(screen.getByRole("button", { name: "Labels, Backend" }));
  fireEvent.click(await screen.findByRole("option", { name: "Backend" }));
  await waitFor(() => expect(mocks.save).toHaveBeenCalledWith("workspace", "project", { labels: [] }));
  expect(navigate).not.toHaveBeenCalled();
});
