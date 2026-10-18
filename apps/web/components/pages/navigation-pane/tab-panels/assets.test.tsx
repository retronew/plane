import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { TPageInstance } from "@/store/pages/base-page";
import { PageNavigationPaneAssetsTabPanel } from "./assets";

vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "workspace" }) }));
vi.mock("@plane/editor", () => ({ CORE_EXTENSIONS: { IMAGE: "image", CUSTOM_IMAGE: "customImage" } }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("./empty-state/assets", () => ({ PageNavigationPaneAssetsTabEmptyState: () => null }));
afterEach(cleanup);

it("renders independent asset and download links and reveals downloads on keyboard focus", () => {
  const page = {
    project_ids: [],
    editor: {
      assetsList: [{ id: "asset", type: "image", src: "https://example.com/image.png", href: "#image", name: "Image" }],
    },
  } as unknown as TPageInstance;
  render(<PageNavigationPaneAssetsTabPanel page={page} />);
  const open = screen.getByRole("link", { name: "Image" });
  const download = screen.getByRole("link", { name: "page_navigation_pane.tabs.assets.download_button" });
  expect(open.querySelector("a")).toBeNull();
  expect(download.closest("a")?.parentElement?.closest("a")).toBeNull();
  expect(open.getAttribute("href")).toBe("#image");
  expect(download.getAttribute("href")).toBe("https://example.com/image.png");
  download.focus();
  expect(document.activeElement).toBe(download);
  expect(download.className).toContain("group-focus-within/asset-item:opacity-100");
});
