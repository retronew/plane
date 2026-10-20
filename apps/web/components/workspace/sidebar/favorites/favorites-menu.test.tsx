import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { SidebarFavoritesMenu } from "./favorites-menu";

vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "workspace" }) }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@plane/blocks/toast", () => ({ setToast: vi.fn() }));
vi.mock("@/hooks/use-local-storage", () => ({ default: () => ({ storedValue: true, setValue: vi.fn() }) }));
vi.mock("@makeplane/propel/components/collapsible", () => ({
  Collapsible: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("./favorites.helpers", () => ({ getInstructionFromPayload: vi.fn() }));
vi.mock("./new-fav-folder", () => ({ NewFavoriteFolder: () => null }));
vi.mock("./favorite-folder", () => ({
  FavoriteFolder: ({ favorite }: { favorite: { id: string } }) => <div>{favorite.id}</div>,
}));
vi.mock("./favorite-items", () => ({
  FavoriteRoot: ({ favorite }: { favorite: { id: string } }) => <div>{favorite.id}</div>,
}));
vi.mock("@/hooks/store/use-favorite", () => ({
  useFavorite: () => ({
    groupedFavorites: {
      folder: { id: "folder", is_folder: true, sequence: 2 },
      item: { id: "item", is_folder: false, sequence: 1 },
    },
  }),
}));

it("renders mixed favorite folders and items without a missing-key warning", () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    render(<SidebarFavoritesMenu />);
    expect(screen.getByText("folder")).toBeTruthy();
    expect(screen.getByText("item")).toBeTruthy();
    expect(error).not.toHaveBeenCalled();
  } finally {
    error.mockRestore();
  }
});
