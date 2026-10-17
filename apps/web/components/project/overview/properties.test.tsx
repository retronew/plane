/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { IProject, IUserLite } from "@plane/types";
import { ProjectOverviewProperties } from "./properties";

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  toast: vi.fn(),
  memberIds: vi.fn(),
  statesEnabled: true,
  categoryError: undefined as Error | undefined,
}));

vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "workspace" }) }));
vi.mock("@plane/i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@plane/i18n")>()),
  useTranslation: () => ({
    currentLocale: "en",
    t: (key: string, params?: { count: number }) =>
      key === "member"
        ? String(params?.count)
        : ({
            "common.properties": "Properties",
            state: "Status",
            priority: "Priority",
            lead: "Lead",
            members: "Members",
            labels: "Labels",
            start_date: "Start date",
            due_date: "Due date",
            "common.none": "None",
            "common.priority": "Priority",
            high: "High",
            none: "None",
            "web.set_date": "Set date",
            "web.no_project_status": "No status",
          }[key] ?? key),
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
    getUserDetails: (id: string) => ({
      id,
      display_name: id === "ada" ? "Ada" : "Grace",
      first_name: id === "ada" ? "Ada" : "Grace",
      last_name: "",
      avatar_url: "",
    }),
    workspace: { workspaceMemberIds: ["ada", "grace"], isUserSuspended: () => false },
    project: { getProjectMemberIds: mocks.memberIds, fetchProjectMembers: vi.fn() },
  }),
}));
vi.mock("@plane/blocks/toast", () => ({ setToast: mocks.toast }));
vi.mock("@/components/settings/workspace/configuration/project-fields", () => ({
  useProjectCategories: () => ({
    labels: [
      { id: "backend", name: "Backend", color: "#123456" },
      { id: "frontend", name: "Frontend", color: "#654321" },
    ],
    statuses: [
      { id: "draft", name: "Draft", group: "draft", is_default: true, color: "#999999" },
      { id: "active", name: "Active", group: "execution", color: "#0088ff" },
    ],
    statesEnabled: mocks.statesEnabled,
    error: mocks.categoryError,
  }),
}));

const project = {
  id: "project",
  status: "active",
  priority: "high",
  project_lead: "ada",
  labels: ["backend"],
  start_date: "2026-10-15",
  target_date: "2026-10-20",
  members: ["ada"],
} as IProject;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.statesEnabled = true;
  mocks.categoryError = undefined;
  mocks.memberIds.mockReturnValue(["ada", "grace"]);
  mocks.save.mockResolvedValue(undefined);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(240);
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(256);
  vi.spyOn(Element.prototype, "clientHeight", "get").mockReturnValue(240);
  Object.defineProperty(Element.prototype, "getAnimations", { configurable: true, value: () => [] });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function setup(overrides: Partial<IProject> = {}, disabled = false) {
  return render(
    <ProjectOverviewProperties project={{ ...project, ...overrides }} workspaceSlug="workspace" disabled={disabled} />
  );
}

function row(label: string) {
  const term = screen.getByText(label, { selector: "dt span" });
  return within(term.closest("div")!);
}

it("renders the seven ordered 44px rows, 16px icons, and borderless property controls", () => {
  const { container } = setup();
  expect(screen.getByRole("heading", { name: "Properties" })).toBeTruthy();
  expect([...container.querySelectorAll("dt")].map((term) => term.textContent)).toEqual([
    "Status",
    "Priority",
    "Lead",
    "Members",
    "Labels",
    "Start date",
    "Due date",
  ]);
  for (const term of container.querySelectorAll("dt")) {
    expect(term.parentElement?.classList.contains("h-11")).toBe(true);
    expect(term.classList.contains("w-[45%]")).toBe(true);
    const icon = term.querySelector("svg");
    expect(icon?.classList.contains("size-4")).toBe(true);
    expect(icon?.getAttribute("viewBox")).toBe("0 0 16 16");
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
  }
  expect(row("Status").getByRole("button").textContent).toContain("Active");
  expect(row("Priority").getByRole("button").textContent).toBe("High");
  expect(row("Lead").getByRole("button").textContent).toContain("Ada");
  expect(row("Labels").getByRole("button").textContent).toContain("Backend");
  for (const button of screen.getAllByRole("button")) {
    expect(button.classList.contains("border-transparent")).toBe(true);
  }
});

it.each([
  [
    "Lead",
    [
      "M14.041 8a6.042 6.042 0 1 0-10.613 3.947",
      "m4.041-5.625a2.042 2.042 0 1 0-4.083 0",
      "M15.291 8A7.291 7.291 0 0 1 .708 8a7.292 7.292 0 0 1 14.583 0",
    ],
  ],
  [
    "Labels",
    ["M6.529.787c.296 0 .547-.004.789.054", "M5.51 4.46a.958.958 0 1 1-1.05 1.05", "M2.038 6.53c0 .355.004.432.02.496"],
  ],
  [
    "Start date",
    [
      "M13.87 10.833a3.375 3.375 0 1 0-6.75 0 3.375 3.375 0 0 0 6.75 0",
      "m-4-2.4a.625.625 0 0 1 1.25 0v2.013l1.255.628",
      "m5.583 7a4.625 4.625 0 1 1-9.25 0 4.625 4.625 0 0 1 9.25 0",
    ],
  ],
])("matches the online %s icon's SVG geometry", (label, pathSegments) => {
  setup();
  const icon = screen.getByText(label, { selector: "dt span" }).closest("dt")?.querySelector("svg");
  expect(icon?.querySelectorAll("path").length).toBe(1);
  const path = icon?.querySelector("path");
  expect(path?.getAttribute("fill")).toBe("currentColor");
  for (const segment of pathSegments) {
    expect(path?.getAttribute("d")).toContain(segment);
  }
});

it("counts the requested project's full roster and falls back to response members before it loads", () => {
  const { rerender } = setup();
  expect(mocks.memberIds).toHaveBeenCalledWith("project", true);
  expect(row("Members").getByText("2")).toBeTruthy();
  mocks.memberIds.mockReturnValue(null);
  rerender(<ProjectOverviewProperties project={project} workspaceSlug="workspace" disabled={false} />);
  expect(row("Members").getByText("1")).toBeTruthy();
  mocks.memberIds.mockReturnValue([]);
  rerender(<ProjectOverviewProperties project={{ ...project }} workspaceSlug="workspace" disabled={false} />);
  expect(row("Members").getByText("0")).toBeTruthy();
});

it("uses the inherited default status and hides the status row when project states are disabled", () => {
  const { rerender } = setup({ status: null });
  expect(row("Status").getByRole("button").textContent).toContain("Draft");
  mocks.statesEnabled = false;
  rerender(<ProjectOverviewProperties project={project} workspaceSlug="workspace" disabled={false} />);
  expect(screen.queryByText("Status")).toBeNull();
  expect(row("Priority").getByRole("button")).toBeTruthy();
});

it("saves a project status through the actual Select", async () => {
  setup();
  fireEvent.click(row("Status").getByRole("button"));
  fireEvent.click(await screen.findByRole("option", { name: "Draft" }));
  await waitFor(() => expect(mocks.save).toHaveBeenCalledWith("workspace", "project", { status: "draft" }));
});

it("saves priority through the actual PrioritySelect", async () => {
  setup({ priority: "none" });
  fireEvent.click(row("Priority").getByRole("button"));
  fireEvent.click(await screen.findByRole("option", { name: "High" }));
  await waitFor(() => expect(mocks.save).toHaveBeenCalledWith("workspace", "project", { priority: "high" }));
});

it.each(["ada", { id: "ada" } as IUserLite])("resolves a lead supplied as %j and allows clearing it", async (lead) => {
  setup({ project_lead: lead });
  expect(row("Lead").getByRole("button").textContent).toContain("Ada");
  fireEvent.click(row("Lead").getByRole("button"));
  fireEvent.click(await screen.findByRole("option", { name: "None" }));
  await waitFor(() => expect(mocks.save).toHaveBeenCalledWith("workspace", "project", { project_lead: null }));
});

it("saves a selected workspace member as the lead", async () => {
  setup();
  fireEvent.click(row("Lead").getByRole("button"));
  fireEvent.click(await screen.findByRole("option", { name: /Grace/ }));
  await waitFor(() => expect(mocks.save).toHaveBeenCalledWith("workspace", "project", { project_lead: "grace" }));
});

it("searches and saves project labels while preserving unresolved existing label IDs", async () => {
  setup({ labels: ["backend", "unloaded-label"] });
  expect(row("Labels").getByRole("button").textContent).toContain("unloaded-label");
  fireEvent.click(row("Labels").getByRole("button"));
  fireEvent.change(await screen.findByPlaceholderText("property_select.search_labels"), {
    target: { value: " FRONT " },
  });
  fireEvent.click(await screen.findByRole("option", { name: "Frontend" }));
  await waitFor(() =>
    expect(mocks.save).toHaveBeenCalledWith("workspace", "project", {
      labels: ["backend", "unloaded-label", "frontend"],
    })
  );
});

it.each([
  ["Start date", "start_date", "October 16th, 2026", "2026-10-16", "October 21st, 2026"],
  ["Due date", "target_date", "October 19th, 2026", "2026-10-19", "October 14th, 2026"],
])(
  "limits %s to the project date range and persists a date-only payload",
  async (label, field, day, payload, invalidDay) => {
    setup();
    fireEvent.click(row(label).getByRole("button"));
    const invalid = screen.getByRole("button", { name: new RegExp(invalidDay) }) as HTMLButtonElement;
    expect(invalid.disabled).toBe(true);
    fireEvent.click(invalid);
    expect(mocks.save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: new RegExp(day) }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith("workspace", "project", { [field]: payload }));
  }
);

it.each([
  ["Start date", "start_date"],
  ["Due date", "target_date"],
])("can clear %s without clearing the other endpoint", async (label, field) => {
  setup();
  fireEvent.click(row(label).getByRole("button"));
  fireEvent.click(screen.getByRole("button", { name: "common.clear" }));
  await waitFor(() => expect(mocks.save).toHaveBeenCalledWith("workspace", "project", { [field]: null }));
});

it("disables every edit control for viewers", () => {
  setup({}, true);
  for (const button of screen.getAllByRole("button")) {
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button);
  }
  expect(mocks.save).not.toHaveBeenCalled();
  expect(screen.queryByRole("option")).toBeNull();
});

it("disables category edits while category loading failed", () => {
  mocks.categoryError = new Error("unavailable");
  setup();
  expect((row("Status").getByRole("button") as HTMLButtonElement).disabled).toBe(true);
  expect((row("Labels").getByRole("button") as HTMLButtonElement).disabled).toBe(true);
  expect((row("Priority").getByRole("button") as HTMLButtonElement).disabled).toBe(false);
});

it("locks edits during a save, reports failure, and permits retry", async () => {
  let rejectSave: (error: Error) => void = () => undefined;
  mocks.save.mockReturnValueOnce(
    new Promise((_, reject) => {
      rejectSave = reject;
    })
  );
  setup();
  fireEvent.click(row("Status").getByRole("button"));
  fireEvent.click(await screen.findByRole("option", { name: "Draft" }));
  await waitFor(() => expect((row("Priority").getByRole("button") as HTMLButtonElement).disabled).toBe(true));
  fireEvent.click(row("Priority").getByRole("button"));
  expect(mocks.save).toHaveBeenCalledTimes(1);
  rejectSave(new Error("save failed"));
  await waitFor(() =>
    expect(mocks.toast).toHaveBeenCalledWith({ type: "error", title: "web.configuration_save_error" })
  );
  // Once activated, Base UI announces this trigger as a combobox rather than a resting button.
  await waitFor(() => expect((row("Status").getByRole("combobox") as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(row("Status").getByRole("combobox"));
  fireEvent.click(await screen.findByRole("option", { name: "Draft" }));
  await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(2));
});
