/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { SWRConfig } from "swr";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import type { IProject, TProjectOverviewUpdate } from "@plane/types";
import { ProjectOverviewUpdates } from "./updates";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  edit: vi.fn(),
  remove: vi.fn(),
  toast: vi.fn(),
  refresh: vi.fn(),
  role: 15,
  workspaceRole: 15,
  userId: "me",
}));
vi.mock("@plane/i18n", async (original) => ({
  ...(await original<typeof import("@plane/i18n")>()),
  useTranslation: () => ({ t: (key: string) => key, currentLocale: "en" }),
}));
vi.mock("@plane/blocks/toast", () => ({ setToast: mocks.toast }));
vi.mock("./use-refresh-activities", () => ({ useRefreshProjectActivities: () => mocks.refresh }));
vi.mock("@/hooks/store/user", () => ({
  useUser: () => ({ data: { id: mocks.userId } }),
  useUserPermissions: () => ({
    allowPermissions: (roles: number[], level: string) =>
      roles.includes(level === EUserPermissionsLevel.WORKSPACE ? mocks.workspaceRole : mocks.role),
  }),
}));
vi.mock("@/services/project/project-overview.service", () => ({
  projectOverviewKey: (slug: string, project: string, resource: string) => [
    "project-overview",
    slug,
    project,
    resource,
  ],
  projectOverviewService: {
    getUpdates: mocks.list,
    createUpdate: mocks.create,
    updateUpdate: mocks.edit,
    deleteUpdate: mocks.remove,
  },
}));

const prefix = "web.project_overview";
const update: TProjectOverviewUpdate = {
  id: "update-1",
  body: "Original\n\n<script>plain text</script>",
  health: "on_track",
  created_by: "me",
  created_by_detail: { id: "me", display_name: "Ada", first_name: "Ada", last_name: "", avatar_url: "", is_bot: false },
  created_at: "2026-10-17T09:00:00Z",
  updated_at: "2026-10-17T09:00:00Z",
};
const project = { id: "project", archived_at: null, project_updates_view: true } as IProject;

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("PointerEvent", MouseEvent);
  mocks.role = EUserPermissions.MEMBER;
  mocks.workspaceRole = EUserPermissions.MEMBER;
  mocks.userId = "me";
  mocks.list.mockResolvedValue([update]);
  mocks.create.mockImplementation(async (_slug, _id, payload) => ({ ...update, ...payload, id: "created" }));
  mocks.edit.mockImplementation(async (_slug, _id, id, payload) => ({ ...update, ...payload, id }));
  mocks.remove.mockResolvedValue(undefined);
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

function setup(overrides: Partial<IProject> = {}) {
  const cache = new Map();
  const view = (values: Partial<IProject>) => (
    <MemoryRouter>
      <SWRConfig value={{ provider: () => cache, dedupingInterval: 0, shouldRetryOnError: false }}>
        <ProjectOverviewUpdates project={{ ...project, ...values }} workspaceSlug="workspace" />
      </SWRConfig>
    </MemoryRouter>
  );
  return { ...render(view(overrides)), view };
}
async function ready() {
  await screen.findByText("Ada");
}
async function openUpdateAction(action: "edit_update" | "delete_update") {
  fireEvent.click(screen.getByRole("button", { name: `${prefix}.update_actions` }));
  fireEvent.click(await screen.findByRole("menuitem", { name: `${prefix}.${action}` }));
}
function startCreate(body: string) {
  fireEvent.click(screen.getByRole("button", { name: `${prefix}.post_update` }));
  expect(screen.getByRole("button", { name: `${prefix}.health, ${prefix}.on_track` }).textContent).toContain(
    `${prefix}.on_track`
  );
  fireEvent.change(screen.getByRole("textbox"), { target: { value: body } });
}

it("shows the disabled feature and navigates to settings without loading or mutating updates", async () => {
  const { container } = setup({ project_updates_view: false });
  await waitFor(() => expect(container.querySelector('svg[viewBox="0 0 72 81"]')).toBeTruthy());
  expect(screen.getByRole("heading", { name: `${prefix}.updates` })).toBeTruthy();
  expect(screen.getByText(`${prefix}.updates_disabled`)).toBeTruthy();
  expect(screen.getByRole("button", { name: `${prefix}.turn_on_updates` }).getAttribute("href")).toBe(
    "/workspace/settings/projects/project/project-updates/"
  );
  expect(screen.queryByRole("button", { name: `${prefix}.post_update` })).toBeNull();
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(mocks.list).not.toHaveBeenCalled();
  expect(mocks.create).not.toHaveBeenCalled();
});

it("removes cached updates and an open editor when disabled, and restores updates when re-enabled", async () => {
  const { rerender, view } = setup();
  await ready();
  startCreate("Unsaved");
  rerender(view({ project_updates_view: false }));
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(screen.queryByText("Ada")).toBeNull();
  expect(screen.getByRole("button", { name: `${prefix}.turn_on_updates` })).toBeTruthy();
  rerender(view({ project_updates_view: true }));
  await ready();
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(screen.getByRole("button", { name: `${prefix}.post_update` })).toBeTruthy();
  expect(mocks.create).not.toHaveBeenCalled();
});

it("renders updates safely as multiline plain text with actor, health and time", async () => {
  const { container } = setup();
  await ready();
  const body = screen.getByText((_, node) => node?.tagName === "P" && node.textContent === update.body);
  expect(body.classList.contains("whitespace-pre-wrap")).toBe(true);
  expect(container.querySelector("script")).toBeNull();
  expect(container.querySelector("time")?.dateTime).toBe(update.created_at);
  expect(screen.getByText(`${prefix}.on_track`)).toBeTruthy();
  expect(mocks.list).toHaveBeenCalledWith("workspace", "project");
});

it("creates with the real health Select and preserves whitespace and blank lines", async () => {
  mocks.list.mockResolvedValue([]);
  setup();
  await screen.findByText(`${prefix}.no_updates`);
  const body = "  First line\n\n<img src=x onerror=alert(1)>\n";
  startCreate(body);
  fireEvent.click(screen.getByRole("button", { name: `${prefix}.health, ${prefix}.on_track` }));
  fireEvent.click(await screen.findByRole("option", { name: `${prefix}.at_risk` }));
  fireEvent.click(screen.getByRole("button", { name: `${prefix}.add_update` }));
  await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());
  expect(mocks.create).toHaveBeenCalledExactlyOnceWith("workspace", "project", { body, health: "at_risk" });
  expect(mocks.refresh).toHaveBeenCalledOnce();
});

it("edits the owner's update and can cancel without saving", async () => {
  setup();
  await ready();
  await openUpdateAction("edit_update");
  expect(screen.getByRole<HTMLTextAreaElement>("textbox").value).toBe(update.body);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Changed\n\nbody" } });
  fireEvent.click(screen.getByRole("button", { name: "cancel" }));
  expect(mocks.edit).not.toHaveBeenCalled();
  await openUpdateAction("edit_update");
  expect(screen.getByRole<HTMLTextAreaElement>("textbox").value).toBe(update.body);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Changed\n\nbody" } });
  fireEvent.click(screen.getByRole("button", { name: "save" }));
  await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());
  expect(mocks.edit).toHaveBeenCalledExactlyOnceWith("workspace", "project", update.id, {
    body: "Changed\n\nbody",
    health: "on_track",
  });
  expect(mocks.refresh).toHaveBeenCalledOnce();
});

it.each(["create", "edit"] as const)("keeps the %s draft on failure, toasts, and retries", async (operation) => {
  mocks[operation].mockRejectedValueOnce(new Error("offline"));
  setup();
  await ready();
  if (operation === "create") startCreate("Draft\n\nkeep");
  else {
    await openUpdateAction("edit_update");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Draft\n\nkeep" } });
  }
  const submitLabel = operation === "create" ? `${prefix}.add_update` : "save";
  fireEvent.click(screen.getByRole("button", { name: submitLabel }));
  await waitFor(() => expect(mocks.toast).toHaveBeenCalledOnce());
  expect(screen.getByRole<HTMLTextAreaElement>("textbox").value).toBe("Draft\n\nkeep");
  fireEvent.click(screen.getByRole("button", { name: submitLabel }));
  await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());
  expect(mocks[operation]).toHaveBeenCalledTimes(2);
});

it("requires confirmation, keeps the failed delete open, and retries deletion", async () => {
  mocks.remove.mockRejectedValueOnce(new Error("offline"));
  setup();
  await ready();
  await openUpdateAction("delete_update");
  let dialog = await screen.findByRole("alertdialog");
  expect(within(dialog).getByText(`${prefix}.delete_update_confirm`)).toBeTruthy();
  expect(mocks.remove).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole("button", { name: "cancel" }));
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  await openUpdateAction("delete_update");
  dialog = await screen.findByRole("alertdialog");
  fireEvent.click(within(dialog).getByRole("button", { name: "delete" }));
  await waitFor(() => expect(mocks.toast).toHaveBeenCalledOnce());
  expect(screen.getByRole("alertdialog")).toBeTruthy();
  fireEvent.click(within(dialog).getByRole("button", { name: "delete" }));
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  expect(mocks.remove).toHaveBeenCalledTimes(2);
  expect(mocks.remove).toHaveBeenLastCalledWith("workspace", "project", update.id);
  expect(mocks.refresh).toHaveBeenCalledOnce();
});

it.each(["project", "workspace"])("allows a %s admin to manage another member's updates", async (level) => {
  mocks.userId = "admin";
  if (level === "project") mocks.role = EUserPermissions.ADMIN;
  else {
    mocks.workspaceRole = EUserPermissions.ADMIN;
    mocks.role = EUserPermissions.GUEST;
  }
  setup();
  await ready();
  await openUpdateAction("edit_update");
  expect(screen.getByRole("textbox")).toBeTruthy();
  expect(screen.getByRole<HTMLButtonElement>("button", { name: "save" }).disabled).toBe(false);
  expect(screen.getByRole("button", { name: `${prefix}.update_actions` })).toBeTruthy();
});

it("allows ordinary members to create but hides other authors' management actions", async () => {
  mocks.userId = "other";
  setup();
  await ready();
  expect(screen.queryByRole("button", { name: `${prefix}.edit_update` })).toBeNull();
  expect(screen.queryByRole("button", { name: `${prefix}.delete_update` })).toBeNull();
  startCreate("Member update");
  expect(screen.getByRole<HTMLButtonElement>("button", { name: `${prefix}.add_update` }).disabled).toBe(false);
});

it.each(["guest", "archived"])("makes %s entirely read-only including an owned update", async (mode) => {
  if (mode === "guest") mocks.role = EUserPermissions.GUEST;
  setup(mode === "archived" ? { archived_at: "2026-10-17" } : {});
  await ready();
  expect(screen.queryByRole("button")).toBeNull();
  expect(screen.queryByRole("textbox")).toBeNull();
});

it("closes the writable surface when the project is archived while editing", async () => {
  const { rerender, view } = setup();
  await ready();
  startCreate("Unsaved");
  rerender(view({ archived_at: "2026-10-17" }));
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(screen.queryByRole("button")).toBeNull();
  expect(mocks.create).not.toHaveBeenCalled();
});

it("shows list errors without a false empty state and permits retry", async () => {
  mocks.list.mockRejectedValueOnce(new Error("offline")).mockResolvedValue([]);
  setup();
  await screen.findByRole("alert");
  expect(screen.queryByText(`${prefix}.no_updates`)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "common.retry" }));
  await screen.findByText(`${prefix}.no_updates`);
  expect(screen.queryByRole("alert")).toBeNull();
});

it("uses unknown_user when the author has been deleted", async () => {
  mocks.list.mockResolvedValue([{ ...update, created_by: null, created_by_detail: null }]);
  setup();
  await screen.findByText("unknown_user");
  expect(screen.queryByRole("button", { name: `${prefix}.edit_update` })).toBeNull();
});

it("locks a pending save and rejects empty bodies and duplicate submissions", async () => {
  let resolve!: (value: TProjectOverviewUpdate) => void;
  mocks.create.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      })
  );
  setup();
  await ready();
  startCreate(" \n\n ");
  expect(screen.getByRole<HTMLButtonElement>("button", { name: `${prefix}.add_update` }).disabled).toBe(true);
  const textarea = screen.getByRole<HTMLTextAreaElement>("textbox");
  fireEvent.change(textarea, { target: { value: "Pending" } });
  const form = screen.getByRole("form");
  fireEvent.submit(form);
  fireEvent.submit(form);
  expect(mocks.create).toHaveBeenCalledOnce();
  expect(textarea.disabled).toBe(true);
  const cancel = screen.getByRole<HTMLButtonElement>("button", { name: "cancel" });
  expect(cancel.disabled).toBe(true);
  fireEvent.click(cancel);
  expect(screen.getByRole("textbox")).toBe(textarea);
  await act(async () => resolve({ ...update, id: "new", body: "Pending" }));
  expect(screen.queryByRole("textbox")).toBeNull();
});

it("locks confirmation and blocks duplicate deletes while pending", async () => {
  let resolve!: () => void;
  mocks.remove.mockImplementationOnce(
    () =>
      new Promise<void>((done) => {
        resolve = done;
      })
  );
  setup();
  await ready();
  await openUpdateAction("delete_update");
  const dialog = await screen.findByRole("alertdialog");
  const confirm = within(dialog).getByRole("button", { name: "delete" });
  fireEvent.click(confirm);
  fireEvent.click(confirm);
  expect(mocks.remove).toHaveBeenCalledOnce();
  expect(within(dialog).getByRole<HTMLButtonElement>("button", { name: "cancel" }).disabled).toBe(true);
  await act(async () => resolve());
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
});
