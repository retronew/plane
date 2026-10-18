import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { SidebarNavItem, SIDEBAR_ROW_LINK_CLASS_NAME } from "./sidebar-navigation";

it("preserves the selected background on hover instead of using the pressed background", () => {
  render(
    <SidebarNavItem isActive>
      <span>Selected item</span>
    </SidebarNavItem>
  );
  const classes = screen.getByText("Selected item").parentElement!.className.split(" ");
  expect(classes).toContain("bg-layer-transparent-selected");
  expect(classes).toContain("hover:bg-layer-transparent-selected");
  expect(classes).toContain("active:bg-layer-transparent-selected");
  expect(classes).not.toContain("active:bg-layer-transparent-active");
  expect(classes).not.toContain("hover:bg-layer-transparent-hover");
  expect(classes).not.toContain("!bg-layer-transparent-active");
  expect(classes).toContain("text-primary");
});

it("uses the shared 32px row shape and lets its button fill the vertical hit area", () => {
  render(
    <SidebarNavItem>
      <button type="button" className={SIDEBAR_ROW_LINK_CLASS_NAME}>
        More
      </button>
    </SidebarNavItem>
  );
  const button = screen.getByRole("button", { name: "More" });
  const classes = button.parentElement!.className.split(" ");
  expect(classes).toEqual(
    expect.arrayContaining([
      "h-8",
      "rounded-lg",
      "gap-2",
      "text-body-sm-medium",
      "hover:bg-layer-transparent-hover",
      "active:bg-layer-transparent-active",
    ])
  );
  expect(classes.some((name) => name.startsWith("py-"))).toBe(false);
  expect(button.className.split(" ")).toContain("h-full");
});
