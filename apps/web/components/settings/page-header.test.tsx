import type { ReactNode } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { SettingsContentWrapper } from "./content-wrapper";
import { SettingsPageHeader } from "./page-header";

vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/use-platform-os", () => ({ usePlatformOS: () => ({ isMobile: false }) }));
vi.mock("./sidebar/collapse", () => ({ SettingsSidebarToggle: () => null }));
vi.mock("@/components/common/extended-app-header", () => ({
  ExtendedAppHeader: ({ header }: { header: ReactNode }) => <div>{header}</div>,
}));
vi.mock("@makeplane/propel/components/scroll-area", () => ({
  ScrollArea: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const originalGetAnimations = Object.getOwnPropertyDescriptor(Element.prototype, "getAnimations");
afterEach(() => {
  vi.unstubAllGlobals();
  if (originalGetAnimations) Object.defineProperty(Element.prototype, "getAnimations", originalGetAnimations);
  else Reflect.deleteProperty(Element.prototype, "getAnimations");
});

it("uses the 48px settings row while rendering standard breadcrumb text and icon slots", () => {
  const { container } = render(
    <SettingsContentWrapper
      header={<SettingsPageHeader breadcrumbs={[{ label: "Projects", icon: <svg data-testid="project-icon" /> }]} />}
    >
      <p>Settings content</p>
    </SettingsContentWrapper>
  );
  const trail = screen.getByRole("navigation", { name: "aria_labels.breadcrumb.trail" });
  expect(within(trail).getByText("Projects").closest('[aria-current="page"]')).toBeTruthy();
  expect(within(trail).getByTestId("project-icon").parentElement?.classList.contains("size-4")).toBe(true);
  expect(container.querySelector(".border-b")?.classList.contains("!h-12")).toBe(true);
  expect(screen.getByText("Settings content")).toBeTruthy();
});

it("keeps the template list link and marks only the editor as the current page", () => {
  render(
    <MemoryRouter>
      <SettingsPageHeader
        breadcrumbs={[{ label: "Templates", href: "/w/settings/templates/" }, { label: "Edit page template" }]}
      />
    </MemoryRouter>
  );
  expect(screen.getByRole("link", { name: "Templates" }).getAttribute("href")).toBe("/w/settings/templates/");
  expect(screen.getByText("Edit page template").closest('[aria-current="page"]')).toBeTruthy();
  expect(screen.getByRole("navigation").querySelectorAll('[aria-current="page"]')).toHaveLength(1);
});

it("keeps the parent template destination available when the trail collapses on small screens", async () => {
  vi.stubGlobal("innerWidth", 375);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  Object.defineProperty(Element.prototype, "getAnimations", { configurable: true, value: () => [] });
  render(
    <MemoryRouter>
      <SettingsPageHeader
        breadcrumbs={[{ label: "Templates", href: "/w/settings/projects/p/templates/" }, { label: "New template" }]}
      />
    </MemoryRouter>
  );
  fireEvent.click(screen.getByRole("button", { name: "aria_labels.breadcrumb.show_more" }));
  const parent = await screen.findByRole("menuitem", { name: "Templates" });
  expect(parent.getAttribute("href")).toBe("/w/settings/projects/p/templates/");
});

it("preserves custom left content and right actions for existing settings headers", () => {
  render(<SettingsPageHeader leftItem={<span>Existing breadcrumb</span>} rightItem={<button>Action</button>} />);
  expect(screen.getByText("Existing breadcrumb")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Action" })).toBeTruthy();
  expect(screen.queryByRole("navigation")).toBeNull();
});
