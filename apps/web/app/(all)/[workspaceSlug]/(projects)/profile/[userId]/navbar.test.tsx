import { act, fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, MemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ProfileNavbar } from "./navbar";

const route = vi.hoisted(() => ({ pathname: "/workspace/profile/user/created/" }));
vi.hoisted(() => {
  HTMLCanvasElement.prototype.getContext = () => null;
});
vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  translate: (key: string) => key,
}));
vi.mock("next/navigation", () => ({
  useParams: () => ({ workspaceSlug: "workspace", userId: "user" }),
  usePathname: () => route.pathname,
}));
beforeEach(() => vi.stubGlobal("matchMedia", () => ({ matches: true })));
afterEach(() => vi.unstubAllGlobals());
it("uses shared route tabs and selects the current profile view with or without a trailing slash", () => {
  const { rerender } = render(
    <MemoryRouter>
      <ProfileNavbar isAuthorized />
    </MemoryRouter>
  );
  const selected = screen.getByRole("tab", { selected: true });
  expect(selected.getAttribute("href")).toBe("/workspace/profile/user/created/");
  expect(screen.getAllByRole("tab")).toHaveLength(5);
  route.pathname = "/workspace/profile/user/created";
  rerender(
    <MemoryRouter>
      <ProfileNavbar isAuthorized />
    </MemoryRouter>
  );
  expect(screen.getByRole("tab", { selected: true }).getAttribute("href")).toBe("/workspace/profile/user/created/");
});
it("selects the destination while the route is still loading", async () => {
  const base = "/workspace/profile/user";
  route.pathname = `${base}/created/`;
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const router = createMemoryRouter(
    [
      {
        path: base,
        element: <ProfileNavbar isAuthorized />,
        children: [{ path: "created/" }, { path: "assigned/", loader: () => pending }],
      },
    ],
    { initialEntries: [route.pathname] }
  );
  render(<RouterProvider router={router} />);
  fireEvent.click(screen.getByRole("tab", { name: "profile.tabs.assigned" }));
  expect(screen.getByRole("tab", { selected: true }).getAttribute("href")).toBe(`${base}/assigned/`);
  expect(router.state.location.pathname).toBe(`${base}/created/`);
  route.pathname = `${base}/assigned/`;
  await act(async () => finish());
  expect(router.state.location.pathname).toBe(route.pathname);
});
it("only exposes the summary tab to visitors without workspace permissions", () => {
  render(
    <MemoryRouter>
      <ProfileNavbar isAuthorized={false} />
    </MemoryRouter>
  );
  expect(screen.getAllByRole("tab")).toHaveLength(1);
  expect(screen.getByRole("tab").getAttribute("href")).toBe("/workspace/profile/user/");
});
