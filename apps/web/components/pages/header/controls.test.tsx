import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { TPageInstance } from "@/store/pages/base-page";
import { PageFavoriteControl } from "./favorite-control";
import { PageLockControl } from "./lock-control";
import { PageCopyLinkControl } from "./copy-link-control";

const mocks = vi.hoisted(() => ({ toggleFavorite: vi.fn(), toggleLock: vi.fn(), copyLink: vi.fn() }));
vi.mock("@/hooks/use-page-operations", () => ({ usePageOperations: () => ({ pageOperations: mocks }) }));
vi.mock("@plane/i18n", () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@makeplane/propel/components/tooltip", () => ({
  Tooltip: ({
    children,
    label,
    side,
    positionMethod,
    collisionAvoidance,
  }: {
    children: React.ReactNode;
    label: string;
    side: string;
    positionMethod: string;
    collisionAvoidance: { side: string; align: string };
  }) => (
    <span
      data-testid="tooltip"
      data-side={side}
      data-label={label}
      data-position-method={positionMethod}
      data-collision-side={collisionAvoidance.side}
      data-collision-align={collisionAvoidance.align}
    >
      {children}
    </span>
  ),
}));
beforeEach(() => vi.clearAllMocks());

it("renders an accessible favorite toggle with the same light yellow as the list", () => {
  const page = { is_favorite: true, canCurrentUserFavoritePage: true } as TPageInstance;
  const { rerender } = render(<PageFavoriteControl page={page} />);
  const selected = screen.getByRole("button", { name: "web.remove_favorite" });
  expect(selected.getAttribute("aria-pressed")).toBe("true");
  const visibleStar = [...selected.querySelectorAll("svg")].find((icon) => icon.classList.contains("opacity-100"));
  expect(visibleStar?.classList.contains("text-[#fbbf24]")).toBe(true);
  fireEvent.click(selected);
  expect(mocks.toggleFavorite).toHaveBeenCalledOnce();
  rerender(<PageFavoriteControl page={{ ...page, is_favorite: false }} />);
  expect(screen.getByRole("button", { name: "web.add_to_favorites" }).getAttribute("aria-pressed")).toBe("false");
});

it("keeps copy feedback on the top without a collision flip", () => {
  render(<PageCopyLinkControl page={{} as TPageInstance} />);
  const tooltip = screen.getByTestId("tooltip");
  expect(tooltip.getAttribute("data-side")).toBe("top");
  expect(tooltip.getAttribute("data-position-method")).toBe("fixed");
  expect(tooltip.getAttribute("data-collision-side")).toBe("none");
  expect(tooltip.getAttribute("data-collision-align")).toBe("shift");
  fireEvent.click(screen.getByRole("button", { name: "web.copy_link" }));
  expect(mocks.copyLink).toHaveBeenCalledOnce();
  expect(tooltip.getAttribute("data-label")).toBe("web.copied");
  expect(tooltip.getAttribute("data-side")).toBe("top");
});

it("hides favorite controls without permission", () => {
  render(<PageFavoriteControl page={{ canCurrentUserFavoritePage: false } as TPageInstance} />);
  expect(screen.queryByRole("button")).toBeNull();
});

it.each([false, true])("positions the lock tooltip above the button (locked: %s)", (isLocked) => {
  render(<PageLockControl page={{ is_locked: isLocked, canCurrentUserLockPage: true } as TPageInstance} />);
  expect(screen.getByTestId("tooltip").getAttribute("data-side")).toBe("top");
  expect(screen.getByTestId("tooltip").getAttribute("data-position-method")).toBe("fixed");
  expect(screen.getByTestId("tooltip").getAttribute("data-collision-side")).toBe("none");
  expect(screen.getByTestId("tooltip").getAttribute("data-collision-align")).toBe("shift");
  expect(screen.getByTestId("tooltip").getAttribute("data-label")).toBe(isLocked ? "web.unlock" : "web.lock");
  fireEvent.click(screen.getByRole("button"));
  expect(mocks.toggleLock).toHaveBeenCalledOnce();
});
