import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { getFileURL } from "@plane/utils";
import { IssueAttachmentsListItem } from "./attachment-list-item";

vi.mock("@/hooks/store/use-member", () => ({ useMember: () => ({ getUserDetails: vi.fn() }) }));
vi.mock("@/hooks/store/use-issue-detail", () => ({
  useIssueDetail: () => ({
    attachment: {
      getAttachmentById: () => ({
        id: "asset",
        asset_url: "/api/assets/asset/",
        attributes: { name: "report.pdf", size: 2048 },
      }),
    },
    toggleDeleteAttachmentModal: vi.fn(),
  }),
}));
vi.mock("@/hooks/use-platform-os", () => ({ usePlatformOS: () => ({ isMobile: false }) }));
vi.mock("@/components/icons", () => ({ getFileIcon: () => null }));
vi.mock("@/components/dropdowns/member/avatar", () => ({ ButtonAvatars: () => null }));
vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  translate: (key: string) => key,
}));

afterEach(() => vi.restoreAllMocks());

it("opens the attachment URL in a new tab without granting opener access", () => {
  const open = vi.spyOn(window, "open").mockReturnValue(null);
  const parentClick = vi.fn();
  render(
    <div role="presentation" onClick={parentClick} onKeyDown={parentClick}>
      <IssueAttachmentsListItem attachmentId="asset" />
    </div>
  );
  fireEvent.click(screen.getByRole("button", { name: "report.pdf" }));
  expect(open).toHaveBeenCalledExactlyOnceWith(getFileURL("/api/assets/asset/"), "_blank", "noopener");
  expect(parentClick).not.toHaveBeenCalled();
});
