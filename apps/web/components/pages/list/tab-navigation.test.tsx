import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { TPageNavigationTabs } from "@plane/types";
import { PageTabNavigation } from "./tab-navigation";

vi.hoisted(() => {
  Element.prototype.getAnimations ??= () => [];
});
vi.mock("@plane/i18n", () => ({ translate: (key: string) => key }));
beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  );
});
afterEach(() => vi.unstubAllGlobals());

function Fixture() {
  const { pathname, search, key } = useLocation();
  const pageType = (new URLSearchParams(search).get("type") ?? "public") as TPageNavigationTabs;
  return (
    <>
      <PageTabNavigation workspaceSlug="workspace" projectId="project" pageType={pageType} />
      <output data-testid="location">{pathname + search}</output>
      <output data-testid="location-key">{key}</output>
    </>
  );
}

function renderNavigation(path = "/workspace/projects/project/pages") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Fixture />
    </MemoryRouter>
  );
}

it("uses shared tabs with real links and defaults to public", () => {
  renderNavigation();
  expect(screen.getByRole("tablist")).toBeTruthy();
  const tabs = screen.getAllByRole("tab");
  expect(tabs).toHaveLength(3);
  for (const [index, type] of ["public", "private", "archived"].entries()) {
    expect(tabs[index].tagName).toBe("A");
    expect(tabs[index].getAttribute("href")).toBe(`/workspace/projects/project/pages?type=${type}`);
    expect(tabs[index].getAttribute("aria-selected")).toBe(String(type === "public"));
  }
});

it.each(["private", "archived"])("retains the %s query selection on direct navigation", (type) => {
  renderNavigation(`/workspace/projects/project/pages?type=${type}`);
  expect(screen.getByRole("tab", { name: `web.${type}` }).getAttribute("aria-selected")).toBe("true");
});

it("updates the route and selection when switching page access and archive tabs", () => {
  renderNavigation();
  for (const type of ["private", "archived", "public"]) {
    fireEvent.click(screen.getByRole("tab", { name: `web.${type}` }));
    expect(screen.getByTestId("location").textContent).toBe(`/workspace/projects/project/pages?type=${type}`);
    expect(screen.getByRole("tab", { name: `web.${type}` }).getAttribute("aria-selected")).toBe("true");
  }
});

it("does not navigate again when clicking the current tab", () => {
  renderNavigation();
  fireEvent.click(screen.getByRole("tab", { name: "web.public" }));
  expect(screen.getByTestId("location").textContent).toBe("/workspace/projects/project/pages");
  expect(screen.getByTestId("location-key").textContent).toBe("default");
});
