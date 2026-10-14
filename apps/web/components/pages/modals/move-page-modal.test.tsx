/** Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MovePageModal } from "./move-page-modal";
import type { TPageInstance } from "@/store/pages/base-page";
import { EPageStoreType } from "@/hooks/store/use-page-store";
const mocks = vi.hoisted(() => ({ move: vi.fn(), push: vi.fn(), fetch: vi.fn(), update: vi.fn(), close: vi.fn() }));
vi.mock("@/hooks/store", () => ({ usePageStore: () => ({ movePage: mocks.move }) }));
vi.mock("@/hooks/store/user", () => ({
  useUserPermissions: () => ({ getProjectRoleByWorkspaceSlugAndProjectId: () => 15 }),
}));
vi.mock("@/hooks/use-app-router", () => ({ useAppRouter: () => ({ push: mocks.push }) }));
vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "workspace" }) }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@plane/blocks/toast", () => ({ setToast: vi.fn() }));
vi.mock("@plane/editor", () => ({ convertBinaryDataToBase64String: () => "encoded" }));
vi.mock("@/services/page", () => ({
  ProjectPageService: class {
    fetchDescriptionBinary = mocks.fetch;
    update = mocks.update;
  },
}));
vi.mock("@/components/dropdowns/project/project-select", () => ({
  ProjectSelect: ({ onChange }: { onChange: (id: string) => void }) => (
    <button onClick={() => onChange("target")}>Select target</button>
  ),
}));
const page = {
  id: "page",
  name: "Title",
  project_ids: ["source"],
  editor: { editorRef: null },
} as unknown as TPageInstance;
const mount = (value = page) =>
  render(<MovePageModal page={value} storeType={EPageStoreType.PROJECT} isOpen onClose={mocks.close} />);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.move.mockResolvedValue(undefined);
});
describe("Move page dialog", () => {
  it("requires a destination and navigates only after a successful move", async () => {
    mount();
    const button = screen.getByRole("button", { name: "web.move_page" });
    expect(button.hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByText("Select target"));
    fireEvent.click(button);
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/workspace/projects/target/pages/page/"));
    expect(mocks.move).toHaveBeenCalledWith("workspace", "source", "page", "target");
  });
  it("keeps the dialog and source page on failure", async () => {
    mocks.move.mockRejectedValue(new Error("forbidden"));
    mount();
    fireEvent.click(screen.getByText("Select target"));
    fireEvent.click(screen.getByRole("button", { name: "web.move_page" }));
    await screen.findByRole("alert");
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.close).not.toHaveBeenCalled();
  });
  it("does not move if saving the current editor fails", async () => {
    mocks.fetch.mockRejectedValue(new Error("offline"));
    mount({ ...page, editor: { editorRef: {} } } as TPageInstance);
    fireEvent.click(screen.getByText("Select target"));
    fireEvent.click(screen.getByRole("button", { name: "web.move_page" }));
    await screen.findByRole("alert");
    expect(mocks.move).not.toHaveBeenCalled();
  });
});
