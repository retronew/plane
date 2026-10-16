import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { Logo } from "./logo";
import { IconRoot } from "./icon/icon-root";
vi.mock("use-font-face-observer", () => ({ default: () => true }));
it("renders backgrounds through the common logo without changing its footprint", () => {
  const { container, rerender } = render(
    <Logo logo={{ in_use: "icon", icon: { name: "home", color: "#5e6ad2" } }} size={16} />
  );
  const icon = container.querySelector<HTMLElement>("[data-logo-icon]")!;
  expect(icon.style.width).toBe("16px");
  expect(icon.style.backgroundColor).toContain("color-mix");
  rerender(
    <Logo
      logo={{ in_use: "icon", icon: { name: "home", color: "#5e6ad2", background_color: "transparent" } }}
      size={16}
    />
  );
  expect(icon.style.backgroundColor).toBe("transparent");
});
it("keeps cleared backgrounds in the icon selection payload and can restore automatic color", () => {
  const onChange = vi.fn();
  const onBackgroundChange = vi.fn();
  render(
    <IconRoot
      defaultColor="#5e6ad2"
      iconType="material"
      searchQuery="home"
      onChange={onChange}
      onBackgroundChange={onBackgroundChange}
    />
  );
  fireEvent.click(screen.getByRole("button", { name: "Clear background" }));
  fireEvent.click(screen.getByRole("button", { name: "home" }));
  expect(onChange).toHaveBeenLastCalledWith({ name: "home", color: "#5e6ad2", background_color: "transparent" });
  fireEvent.click(screen.getByRole("button", { name: "Automatic background" }));
  expect(onBackgroundChange).toHaveBeenLastCalledWith(undefined);
});
