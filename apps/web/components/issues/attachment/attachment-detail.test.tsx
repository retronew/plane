import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, expect, it, vi } from "vitest";
import { IssueAttachmentsDetail } from "./attachment-detail";

const mocks = vi.hoisted(() => ({
  user: { id: "creator", display_name: "Ada", first_name: "Ada", email: "ada@example.test", avatar_url: "" } as
    | { id: string; display_name: string; first_name: string; email: string; avatar_url: string }
    | undefined,
  getUserDetails: vi.fn(),
}));
vi.mock("@/hooks/store/use-member", () => ({ useMember: () => ({ getUserDetails: mocks.getUserDetails }) }));
vi.mock("@/hooks/store/use-issue-detail", () => ({
  useIssueDetail: () => ({
    attachment: {
      getAttachmentById: () => ({
        id: "asset",
        created_by: "creator",
        updated_by: "editor",
        updated_at: "2026-10-18",
        asset_url: "/api/assets/asset/",
        attributes: { name: "Quarterly financial report.pdf", size: 2048 },
      }),
    },
  }),
}));
vi.mock("@/hooks/use-platform-os", () => ({ usePlatformOS: () => ({ isMobile: false }) }));
vi.mock("@/components/icons", () => ({ getFileIcon: () => null }));
vi.mock("./delete-attachment-modal", () => ({ IssueAttachmentDeleteModal: () => null }));
vi.mock("@plane/i18n", () => ({ translate: (key: string) => key }));

beforeEach(() => {
  mocks.user = { id: "creator", display_name: "Ada", first_name: "Ada", email: "ada@example.test", avatar_url: "" };
  mocks.getUserDetails.mockReset().mockImplementation(() => mocks.user);
});

function fixture() {
  return render(
    <MemoryRouter initialEntries={["/workspace/intake"]}>
      <Routes>
        <Route
          path="/:workspaceSlug/intake"
          element={
            <IssueAttachmentsDetail
              attachmentId="asset"
              attachmentHelpers={{
                operations: { create: vi.fn(), remove: vi.fn() },
                snapshot: { uploadStatus: undefined },
              }}
            />
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

it("shows the original uploader with a profile link beside the attachment", () => {
  fixture();
  const profile = screen.getByRole("link", { name: "Ada" });
  expect(profile.getAttribute("href")).toBe("/workspace/profile/creator/");
  expect(mocks.getUserDetails).toHaveBeenCalledWith("creator");
  expect(mocks.getUserDetails).not.toHaveBeenCalledWith("editor");
  expect(screen.getByText("PDF")).toBeTruthy();
  expect(screen.getByRole("link", { name: /Quarterly financial report/ })).toBeTruthy();
  expect(screen.getByRole("button", { name: "attachment.delete" })).toBeTruthy();
});

it("omits the uploader slot when the member cannot be resolved", () => {
  mocks.user = undefined;
  fixture();
  expect(screen.getAllByRole("link")).toHaveLength(1);
  expect(screen.queryByRole("img")).toBeNull();
  expect(screen.getByText("PDF")).toBeTruthy();
});
