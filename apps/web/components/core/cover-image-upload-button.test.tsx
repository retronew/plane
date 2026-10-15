import { fireEvent, render, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";
import { beforeEach, expect, it, vi } from "vitest";
import { EFileAssetType } from "@plane/types";
import { CoverImageUploadButton } from "./cover-image-upload-button";
const mocks = vi.hoisted(() => ({ workspace: vi.fn(), user: vi.fn(), toast: vi.fn(), change: vi.fn(), busy: vi.fn() }));
vi.mock("@/services/file.service", () => ({
  FileService: class {
    uploadWorkspaceAsset = mocks.workspace;
    uploadUserAsset = mocks.user;
  },
}));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@plane/blocks/toast", () => ({ setToast: mocks.toast }));
function setup(profile = false) {
  const view = render(
    <MemoryRouter initialEntries={["/workspace/"]}>
      <Routes>
        <Route
          path="/:workspaceSlug"
          element={
            <CoverImageUploadButton
              label="Change cover"
              onChange={mocks.change}
              onUploadingChange={mocks.busy}
              isProfileCover={profile}
              projectId="project"
            />
          }
        />
      </Routes>
    </MemoryRouter>
  );
  return { ...view, input: view.container.querySelector('input[type="file"]')! };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.workspace.mockResolvedValue({ asset_url: "/uploaded-cover" });
  mocks.user.mockResolvedValue({ asset_url: "/user-cover" });
});
it("uploads a picked project cover directly and only emits it after success", async () => {
  let resolve!: (value: { asset_url: string }) => void;
  mocks.workspace.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    })
  );
  const { input } = setup();
  const file = new File(["image"], "cover.png", { type: "image/png" });
  fireEvent.change(input, { target: { files: [file] } });
  expect(mocks.workspace).toHaveBeenCalledWith(
    "workspace",
    { entity_identifier: "project", entity_type: EFileAssetType.PROJECT_COVER },
    file
  );
  expect(mocks.change).not.toHaveBeenCalled();
  expect(mocks.busy).toHaveBeenCalledWith(true);
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  resolve({ asset_url: "/uploaded-cover" });
  await waitFor(() => expect(mocks.change).toHaveBeenCalledWith("/uploaded-cover"));
  expect(mocks.busy).toHaveBeenLastCalledWith(false);
});
it("uses the user asset endpoint for profile covers", async () => {
  const { input } = setup(true);
  fireEvent.change(input, { target: { files: [new File(["image"], "cover.webp", { type: "image/webp" })] } });
  await waitFor(() => expect(mocks.change).toHaveBeenCalledWith("/user-cover"));
  expect(mocks.workspace).not.toHaveBeenCalled();
});
it("keeps the previous cover and permits retry after failure", async () => {
  mocks.workspace.mockRejectedValueOnce(new Error("Offline"));
  const { input } = setup();
  const file = new File(["image"], "cover.jpg", { type: "image/jpeg" });
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
  expect(mocks.change).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => expect(mocks.change).toHaveBeenCalledWith("/uploaded-cover"));
});
it("does nothing when the native file chooser is cancelled", () => {
  const { input } = setup();
  fireEvent.change(input, { target: { files: [] } });
  expect(mocks.workspace).not.toHaveBeenCalled();
  expect(mocks.change).not.toHaveBeenCalled();
});
it("rejects unsupported and oversized files before uploading", () => {
  const { input } = setup();
  fireEvent.change(input, { target: { files: [new File(["pdf"], "file.pdf", { type: "application/pdf" })] } });
  fireEvent.change(input, {
    target: { files: [new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.png", { type: "image/png" })] },
  });
  expect(mocks.toast).toHaveBeenCalledTimes(2);
  expect(mocks.workspace).not.toHaveBeenCalled();
});
