import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { ListItem } from "./list-item";

const mocks = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("@/hooks/use-app-router", () => ({ useAppRouter: () => mocks }));
vi.mock("@makeplane/propel/components/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => children,
}));

const props = {
  title: "Project view",
  itemLink: "/workspace/projects/project/views/view",
  parentRef: createRef<HTMLDivElement>(),
};

beforeEach(() => vi.clearAllMocks());

it("stretches the opt-in link across the row and keeps actions above it", () => {
  const favorite = vi.fn();
  const menu = vi.fn();
  render(
    <ListItem
      {...props}
      fullRowLink
      actionableItems={<button onClick={favorite}>Favorite</button>}
      quickActionElement={<button onClick={menu}>Menu</button>}
    />
  );
  const link = screen.getByRole("link", { name: props.title });
  expect(link.className).toContain("after:inset-0");
  expect(link.className).toContain("static");
  expect(link.parentElement?.className).toContain("static");
  expect(screen.getByRole("button", { name: "Favorite" }).parentElement?.className).toContain("z-20");
  expect(screen.getByRole("button", { name: "Menu" }).parentElement?.className).toContain("z-20");
  fireEvent.click(screen.getByRole("button", { name: "Favorite" }));
  fireEvent.click(screen.getByRole("button", { name: "Menu" }));
  expect(favorite).toHaveBeenCalledOnce();
  expect(menu).toHaveBeenCalledOnce();
  expect(mocks.push).not.toHaveBeenCalled();
  fireEvent.click(link);
  expect(mocks.push).toHaveBeenCalledWith(props.itemLink);
});

it("preserves native modified clicks and disabled links", () => {
  const { rerender } = render(<ListItem {...props} fullRowLink />);
  const link = screen.getByRole("link");
  link.addEventListener("click", (event) => event.preventDefault());
  fireEvent.click(link, { ctrlKey: true });
  expect(mocks.push).not.toHaveBeenCalled();
  rerender(<ListItem {...props} fullRowLink disableLink />);
  expect(screen.queryByRole("link")).toBeNull();
  fireEvent.click(screen.getByText(props.title));
  expect(mocks.push).not.toHaveBeenCalled();
});

it("leaves regular rows unchanged and preserves compact stretched links", () => {
  const { rerender } = render(<ListItem {...props} />);
  expect(screen.getByRole("link").className).not.toContain("after:inset-0");
  rerender(<ListItem {...props} compact />);
  expect(screen.getByRole("link").className).toContain("after:inset-0");
  expect(screen.getByRole("link").className).toContain("after:rounded-[6px]");
});
