import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.stubGlobal("PointerEvent", MouseEvent);
afterAll(() => vi.unstubAllGlobals());
import type { IWorkspaceMemberInvitation } from "@plane/types";
import { Invitations } from "./invitations";
import { WorkspaceJoinInvitesStep } from "./steps/workspace/join-invites";

const { joinWorkspaces } = vi.hoisted(() => ({ joinWorkspaces: vi.fn() }));
vi.mock("@plane/i18n", () => ({ translate: (key: string) => key, Translation: () => null }));
vi.mock("@/components/workspace/logo", () => ({ WorkspaceLogo: () => null }));
vi.mock("@/hooks/store/use-workspace", () => ({ useWorkspace: () => ({ fetchWorkspaces: vi.fn() }) }));
vi.mock("@/hooks/store/user", () => ({ useUserSettings: () => ({ fetchCurrentUserSettings: vi.fn() }) }));
vi.mock("@/services/workspace.service", () => ({
  WorkspaceService: class {
    joinWorkspaces = joinWorkspaces;
  },
}));
vi.mock("./steps/common", () => ({ CommonOnboardingHeader: () => null }));

const invitations = [
  { id: "invite-1", role: 20, workspace: { name: "Design", logo_url: null } },
] as unknown as IWorkspaceMemberInvitation[];

describe.each([
  { Component: Invitations, name: "legacy" },
  { Component: WorkspaceJoinInvitesStep, name: "step" },
])("workspace invitation selection ($name)", ({ Component }) => {
  beforeEach(() => {
    joinWorkspaces.mockReset();
  });

  it("connects the card label to a controlled checkbox and submits its selection", async () => {
    joinWorkspaces.mockResolvedValue(undefined);
    const next = vi.fn();
    render(<Component invitations={invitations} handleNextStep={next} handleCurrentViewChange={vi.fn()} />);
    const checkbox = screen.getByRole("checkbox", { name: "Design" });
    expect(checkbox.closest("label")).not.toBeNull();
    expect(checkbox.getAttribute("aria-checked")).toBe("false");
    // Native checkbox activation (including keyboard activation) uses this same change path.
    fireEvent.click(checkbox);
    expect(checkbox.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: /web.continue/ }));
    await waitFor(() => expect(joinWorkspaces).toHaveBeenCalledWith({ invitations: ["invite-1"] }));
    await waitFor(() => expect(next).toHaveBeenCalledOnce());
  });

  it("withdraws a selected invitation and blocks changes while joining", async () => {
    joinWorkspaces.mockReturnValue(new Promise(() => {}));
    render(<Component invitations={invitations} handleNextStep={vi.fn()} handleCurrentViewChange={vi.fn()} />);
    const checkbox = screen.getByRole("checkbox", { name: "Design" });
    fireEvent.click(checkbox);
    fireEvent.click(checkbox);
    expect(checkbox.getAttribute("aria-checked")).toBe("false");
    expect((screen.getByRole("button", { name: /web.continue/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole("button", { name: /web.continue/ }));
    await waitFor(() =>
      expect(checkbox.getAttribute("aria-disabled") === "true" || (checkbox as HTMLInputElement).disabled).toBe(true)
    );
  });
});
