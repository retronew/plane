import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { expect, it, vi } from "vitest";
import { FavoriteItemTitle } from "./favorite-item-title";
import { FavoriteItemWrapper } from "./favorite-item-wrapper";

const toggleSidebar = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/store/use-app-theme", () => ({ useAppTheme: () => ({ toggleSidebar }) }));
vi.mock("@/hooks/use-platform-os", () => ({ usePlatformOS: () => ({ isMobile: true }) }));

it("fills the fixed-height row with the navigation link and keeps quick actions independent", () => {
  const quickAction = vi.fn();
  const { container } = render(
    <MemoryRouter initialEntries={["/workspace/project/"]}>
      <FavoriteItemWrapper elementRef={createRef<HTMLDivElement>()}>
        <FavoriteItemTitle href="/workspace/project" title="Favorite" icon={<span />} className="h-full" />
        <button type="button" onClick={quickAction}>
          Quick action
        </button>
      </FavoriteItemWrapper>
    </MemoryRouter>
  );
  const link = screen.getByRole("link", { name: "Favorite" });
  expect(link.className.split(" ")).toContain("h-full");
  expect(link.getAttribute("aria-current")).toBe("page");
  expect(container.querySelector(".group\\/project-item")?.className).not.toContain("py-");
  fireEvent.click(link);
  expect(toggleSidebar).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Quick action" }));
  expect(quickAction).toHaveBeenCalledTimes(1);
  expect(toggleSidebar).toHaveBeenCalledTimes(1);
});

it("keeps the title used in drag previews free of row padding", () => {
  render(
    <MemoryRouter>
      <FavoriteItemTitle href="/workspace/project" title="Drag preview" icon={<span />} />
    </MemoryRouter>
  );
  expect(screen.getByRole("link", { name: "Drag preview" }).className).not.toContain("py-");
});
