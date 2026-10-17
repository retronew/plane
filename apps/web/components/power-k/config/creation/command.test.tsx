import { renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { TPowerKContext } from "@/components/power-k/core/types";
import { usePowerKCreationCommandsRecord } from "./command";

const mocks = vi.hoisted(() => ({
  project: { issue_views_view: true } as { issue_views_view?: boolean } | undefined,
  allowPermissions: vi.fn(() => true),
  toggleCreateViewModal: vi.fn(),
}));
vi.mock("@/hooks/use-can-create-project", () => ({ useCanCreateProject: () => true }));
vi.mock("@/hooks/store/use-instance", () => ({ useInstance: () => ({ config: {} }) }));
vi.mock("@/hooks/store/use-project", () => ({
  useProject: () => ({ workspaceProjectIds: ["project"], getPartialProjectById: () => mocks.project }),
}));
vi.mock("@/hooks/store/user", () => ({
  useUser: () => ({ canPerformAnyCreateAction: true, permission: { allowPermissions: mocks.allowPermissions } }),
}));
vi.mock("@/hooks/store/use-command-palette", () => ({ useCommandPalette: () => mocks }));
const ctx = { params: { workspaceSlug: "workspace", projectId: "project" } } as unknown as TPowerKContext;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.project = { issue_views_view: true };
  mocks.allowPermissions.mockReturnValue(true);
});

it.each([undefined, {}, { issue_views_view: false }])(
  "hides and blocks the create-view command without an enabled feature: %j",
  (project) => {
    mocks.project = project;
    const { result } = renderHook(usePowerKCreationCommandsRecord);
    const command = result.current.create_view;
    expect(command.isVisible(ctx)).toBe(false);
    expect(command.isEnabled(ctx)).toBe(false);
    if (command.type === "action") command.action(ctx);
    expect(mocks.toggleCreateViewModal).not.toHaveBeenCalled();
  }
);

it("opens creation for enabled projects with member permissions", () => {
  const { result } = renderHook(usePowerKCreationCommandsRecord);
  const command = result.current.create_view;
  expect(command.isVisible(ctx)).toBe(true);
  expect(command.isEnabled(ctx)).toBe(true);
  if (command.type === "action") command.action(ctx);
  expect(mocks.toggleCreateViewModal).toHaveBeenCalledWith(true);
});

it("rechecks a captured action after the feature is disabled", () => {
  const { result } = renderHook(usePowerKCreationCommandsRecord);
  const command = result.current.create_view;
  mocks.project = { issue_views_view: false };
  if (command.type === "action") command.action(ctx);
  expect(mocks.toggleCreateViewModal).not.toHaveBeenCalled();
});

it("preserves project permission and project-context restrictions", () => {
  const { result } = renderHook(usePowerKCreationCommandsRecord);
  const command = result.current.create_view;
  mocks.allowPermissions.mockReturnValue(false);
  expect(command.isVisible(ctx)).toBe(false);
  expect(command.isEnabled(ctx)).toBe(false);
  if (command.type === "action") command.action(ctx);
  mocks.allowPermissions.mockReturnValue(true);
  const workspaceContext = { ...ctx, params: { workspaceSlug: "workspace" } };
  expect(command.isVisible(workspaceContext)).toBe(false);
  expect(command.isEnabled(workspaceContext)).toBe(false);
  if (command.type === "action") command.action(workspaceContext);
  expect(mocks.toggleCreateViewModal).not.toHaveBeenCalled();
});
