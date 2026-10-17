import type { ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { EPageAccess } from "@plane/constants";
import { PagesListHeader } from "./header";

const mocks = vi.hoisted(() => ({ createPage: vi.fn(), push: vi.fn(), toast: vi.fn(), pageType: "public" }));
vi.mock("next/navigation", () => ({
  useParams: () => ({ workspaceSlug: "workspace", projectId: "url-project" }),
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => new URLSearchParams({ type: mocks.pageType }),
}));
vi.mock("swr", () => ({ default: () => ({ data: [] }) }));
vi.mock("@/components/settings/workspace/configuration/template-application", () => ({ isTemplateAvailable: vi.fn() }));
vi.mock("@/services/workspace-configuration.service", () => ({
  configurationKey: () => "templates",
  workspaceConfigurationService: { list: vi.fn() },
}));
vi.mock("@/hooks/store/use-command-palette", () => ({ useCommandPalette: () => ({ toggleCreatePageModal: vi.fn() }) }));
vi.mock("@/hooks/store/use-project", () => ({
  useProject: () => ({ currentProjectDetails: undefined, loader: "init-loader" }),
}));
vi.mock("@/hooks/store", () => ({
  EPageStoreType: { PROJECT: "PROJECT" },
  usePageStore: () => ({ canCurrentUserCreatePage: true, createPage: mocks.createPage }),
}));
vi.mock("@plane/i18n", () => ({ translate: (key: string) => key }));
vi.mock("@plane/blocks/toast", () => ({ setToast: mocks.toast }));
vi.mock("@plane/blocks/layout", () => {
  const Container = ({ children }: { children: ReactNode }) => children;
  return { Header: Object.assign(Container, { LeftItem: Container, RightItem: Container }) };
});
vi.mock("@plane/blocks/breadcrumb", () => ({
  Breadcrumbs: Object.assign(({ children }: { children: ReactNode }) => children, { Item: () => null }),
}));
vi.mock("@/components/common/breadcrumb-link", () => ({ BreadcrumbLink: () => null }));
vi.mock("@/components/breadcrumbs/common", () => ({ CommonProjectBreadcrumbs: () => null }));
vi.mock("@/components/breadcrumbs/use-project-crumb-props", () => ({ useProjectCrumbProps: () => ({}) }));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.pageType = "public";
});

it.each([
  ["public", EPageAccess.PUBLIC],
  ["private", EPageAccess.PRIVATE],
] as const)(
  "navigates immediately after creating a %s page while project details are unavailable",
  async (pageType, access) => {
    mocks.pageType = pageType;
    let complete!: (page: { id: string }) => void;
    mocks.createPage.mockReturnValue(new Promise((resolve) => (complete = resolve)));
    render(<PagesListHeader />);
    fireEvent.click(screen.getByRole("button", { name: "web.add_page" }));
    expect(mocks.createPage).toHaveBeenCalledExactlyOnceWith({ access }, { addToStore: false });
    expect(mocks.push).not.toHaveBeenCalled();

    await act(async () => complete({ id: "new-page" }));

    expect(mocks.push).toHaveBeenCalledExactlyOnceWith("/workspace/projects/url-project/pages/new-page");
  }
);

it("does not navigate when creation returns undefined", async () => {
  mocks.createPage.mockResolvedValue(undefined);
  render(<PagesListHeader />);
  fireEvent.click(screen.getByRole("button", { name: "web.add_page" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "web.add_page" })).toBeTruthy());
  expect(mocks.createPage).toHaveBeenCalledOnce();
  expect(mocks.push).not.toHaveBeenCalled();
  expect(mocks.toast).not.toHaveBeenCalled();
});

it("does not navigate and reports rejected creation", async () => {
  mocks.createPage.mockRejectedValue(new Error("offline"));
  render(<PagesListHeader />);
  fireEvent.click(screen.getByRole("button", { name: "web.add_page" }));
  await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ type: "error" })));
  expect(mocks.push).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.getByRole("button", { name: "web.add_page" })).toBeTruthy());
});
