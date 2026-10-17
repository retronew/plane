/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { IProject } from "@plane/types";
import { ProjectOverviewContent } from "./content";

const mocks = vi.hoisted(() => ({ save: vi.fn(), toast: vi.fn() }));
vi.mock("@/hooks/store/use-project", () => ({ useProject: () => ({ updateProject: mocks.save }) }));
vi.mock("@plane/blocks/toast", () => ({ setToast: mocks.toast }));
vi.mock("@/components/core/cover-image-upload-button", () => ({
  CoverImageUploadButton: ({ onChange, disabled }: { onChange: (url: string) => void; disabled: boolean }) => (
    <button disabled={disabled} onClick={() => onChange("/api/assets/v2/static/cover/")}>
      Upload cover
    </button>
  ),
}));
vi.mock("@plane/blocks/emoji-icon-picker", () => ({
  EmojiPicker: ({ onChange, disabled }: { onChange: (value: object) => void; disabled: boolean }) => (
    <button disabled={disabled} onClick={() => onChange({ type: "emoji", value: "128077" })}>
      Change logo
    </button>
  ),
  ProjectLogo: () => null,
  getIconBackgroundStyle: () => ({}),
}));
vi.mock("./description", () => ({ ProjectOverviewDescription: () => <p>Description</p> }));
vi.mock("./progress", () => ({ ProjectOverviewProgress: () => <p>Progress</p> }));
vi.mock("./resources", () => ({ ProjectOverviewResources: () => <p>Resources</p> }));
const project = {
  id: "project",
  name: "Delivery",
  logo_props: { in_use: "emoji", emoji: { value: "128640" } },
} as IProject;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.save.mockResolvedValue(project);
});
it("saves the uploaded cover association and the selected project logo", async () => {
  render(<ProjectOverviewContent project={project} workspaceSlug="workspace" disabled={false} />);
  fireEvent.click(screen.getByRole("button", { name: "Upload cover" }));
  await waitFor(() =>
    expect(mocks.save).toHaveBeenCalledWith("workspace", "project", {
      cover_image: expect.stringContaining("/api/assets/v2/static/cover/"),
      cover_image_url: "/api/assets/v2/static/cover/",
    })
  );
  await waitFor(() =>
    expect((screen.getByRole("button", { name: "Change logo" }) as HTMLButtonElement).disabled).toBe(false)
  );
  fireEvent.click(screen.getByRole("button", { name: "Change logo" }));
  await waitFor(() =>
    expect(mocks.save).toHaveBeenCalledWith("workspace", "project", {
      logo_props: { in_use: "emoji", emoji: { value: "128077" } },
    })
  );
});
it("hides cover upload and disables logo editing when read-only", () => {
  render(<ProjectOverviewContent project={project} workspaceSlug="workspace" disabled />);
  expect(screen.queryByRole("button", { name: "Upload cover" })).toBeNull();
  expect((screen.getByRole("button", { name: "Change logo" }) as HTMLButtonElement).disabled).toBe(true);
  expect(mocks.save).not.toHaveBeenCalled();
});
it("reports failed saves and allows a retry", async () => {
  mocks.save.mockRejectedValueOnce(new Error("offline"));
  vi.spyOn(console, "error").mockImplementationOnce(() => {});
  render(<ProjectOverviewContent project={project} workspaceSlug="workspace" disabled={false} />);
  fireEvent.click(screen.getByRole("button", { name: "Upload cover" }));
  await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ type: "error" })));
  fireEvent.click(screen.getByRole("button", { name: "Upload cover" }));
  await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(2));
});
