import { createRef } from "react";
import { render } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { IFavorite } from "@plane/types";
import { FavoriteItemQuickAction } from "./favorite-item-quick-action";

vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

it("only reserves title space while the row is hovered, focused or its menu is open", () => {
  const props = {
    ref: createRef<HTMLDivElement>(),
    favorite: { id: "favorite-1" } as IFavorite,
    onChange: vi.fn(),
    handleRemoveFromFavorites: vi.fn(),
  };
  const { rerender } = render(<FavoriteItemQuickAction {...props} isMenuActive={false} />);
  expect(props.ref.current).not.toBeNull();
  const classes = props.ref.current!.className.split(" ");
  expect(classes).toContain("hidden");
  expect(classes).toContain("group-hover/project-item:flex");
  expect(classes).toContain("group-focus-within/project-item:flex");
  expect(classes).not.toContain("opacity-0");
  rerender(<FavoriteItemQuickAction {...props} isMenuActive />);
  expect(props.ref.current!.className.split(" ")).toContain("flex");
  expect(props.ref.current!.className.split(" ")).not.toContain("hidden");
});
