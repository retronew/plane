import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { IssueLinkItem } from "./link-item";

const mocks = vi.hoisted(() => ({
  copy: vi.fn(),
  toggle: vi.fn(),
  setData: vi.fn(),
  remove: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  translate: (key: string) => key,
}));
vi.mock("@plane/blocks/toast", () => ({ setToast: mocks.toast }));
vi.mock("@plane/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@plane/utils")>();
  return {
    ...actual,
    copyTextToClipboard: mocks.copy,
    calculateTimeAgo: () => "2h ago",
    renderFormattedDate: () => "Nov 28, 2026",
  };
});
vi.mock("@/components/dropdowns/member/avatar", () => ({ ButtonAvatars: () => <span data-testid="avatar" /> }));
vi.mock("@/hooks/store/use-member", () => ({
  useMember: () => ({ getUserDetails: () => ({ display_name: "Ada" }) }),
}));
vi.mock("@/hooks/use-platform-os", () => ({ usePlatformOS: () => ({ isMobile: false }) }));
vi.mock("@/hooks/store/use-issue-detail", () => ({
  useIssueDetail: () => ({
    toggleIssueLinkModal: mocks.toggle,
    setIssueLinkData: mocks.setData,
    link: {
      getLinkById: () => ({
        id: "link-1",
        title: "Design Spec",
        url: "https://docs.example.com/spec",
        created_at: new Date("2026-11-28T00:00:00Z"),
        created_by_id: "user-1",
        metadata: {},
      }),
    },
  }),
}));

beforeEach(() => {
  mocks.copy.mockReset();
  mocks.toggle.mockReset();
  mocks.setData.mockReset();
  mocks.remove.mockReset();
  mocks.toast.mockReset();
});

it("renders a flush h-11 row matching attachment items with link, hostname metadata, avatar, and copy/menu controls", () => {
  const { container } = render(
    <IssueLinkItem
      linkId="link-1"
      isNotAllowed={false}
      linkOperations={{ create: vi.fn(), remove: mocks.remove, update: vi.fn() }}
    />
  );

  const row = container.firstElementChild as HTMLElement;
  expect(row.className).toContain("h-11");
  expect(row.className).toContain("px-3");
  expect(row.className).toContain("hover:bg-surface-2");
  expect(row.className).not.toContain("border-[0.5px]");

  const anchor = screen.getByRole("link");
  expect(anchor.getAttribute("href")).toBe("https://docs.example.com/spec");
  expect(anchor.getAttribute("target")).toBe("_blank");
  expect(screen.getByText("Design Spec")).toBeTruthy();
  expect(screen.getByText("docs.example.com")).toBeTruthy();
  expect(screen.getByTestId("avatar")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "common.actions.copy_link" }));
  expect(mocks.copy).toHaveBeenCalledExactlyOnceWith("https://docs.example.com/spec");
  expect(mocks.toast).toHaveBeenCalledTimes(1);
});
