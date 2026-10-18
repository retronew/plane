import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { IssueLinkDetail } from "./link-detail";

const mocks = vi.hoisted(() => ({ copy: vi.fn(), toggle: vi.fn(), remove: vi.fn() }));
vi.mock("@plane/i18n", () => ({ translate: (key: string) => key, Translation: () => null }));
vi.mock("@plane/blocks/toast", () => ({ setToast: vi.fn() }));
vi.mock("@plane/utils", () => ({
  getIconForLink: () => "svg",
  copyTextToClipboard: mocks.copy,
  calculateTimeAgo: () => "now",
}));
vi.mock("@/hooks/store/use-issue-detail", () => ({
  useIssueDetail: () => ({
    toggleIssueLinkModal: mocks.toggle,
    setIssueLinkData: vi.fn(),
    link: {
      getLinkById: () => ({ id: "link", title: "Documentation", url: "https://example.com", created_at: "2026-01-01" }),
    },
  }),
}));
vi.mock("@/hooks/store/use-member", () => ({ useMember: () => ({ getUserDetails: () => undefined }) }));
vi.mock("@/hooks/use-platform-os", () => ({ usePlatformOS: () => ({ isMobile: true }) }));

it("provides a native copy button with independent edit, visit and remove controls", () => {
  render(<IssueLinkDetail linkId="link" isNotAllowed={false} linkOperations={{ remove: mocks.remove } as never} />);
  const copy = screen.getByRole("button", { name: "copy_link" });
  expect(copy.tagName).toBe("BUTTON");
  expect(copy.getAttribute("type")).toBe("button");
  copy.focus();
  expect(document.activeElement).toBe(copy);
  fireEvent.click(copy);
  expect(mocks.copy).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "edit" }));
  expect(mocks.toggle).toHaveBeenCalledWith(true);
  fireEvent.click(screen.getByRole("button", { name: "web.remove" }));
  expect(mocks.remove).toHaveBeenCalledWith("link");
  expect(mocks.copy).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("link", { name: "Documentation" }).getAttribute("href")).toBe("https://example.com");
  expect(copy.querySelector("button, a, input")).toBeNull();
});
