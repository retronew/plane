import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { TypesLogo } from "./types-logo";

vi.mock("@plane/blocks/emoji-icon-picker", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@plane/blocks/emoji-icon-picker")>();
  return {
    ...actual,
    Logo: ({ type, size, background }: { type?: string; size: number; background?: boolean }) => (
      <span data-testid="logo" data-icon-type={type} data-icon-size={size} data-background={background} />
    ),
  };
});

it.each([
  { name: "Bug", renderer: "lucide" },
  { name: "circle", renderer: "material" },
  { name: "check_circle", renderer: "material" },
])("renders $name with its matching icon catalog", ({ name, renderer }) => {
  render(<TypesLogo type={{ logo_props: { in_use: "icon", icon: { name } } }} size={16} />);
  expect(screen.getByTestId("logo").getAttribute("data-icon-type")).toBe(renderer);
  expect(screen.getByTestId("logo").getAttribute("data-icon-size")).toBe("16");
});

it.each([undefined, {}, { in_use: "icon", icon: { name: "unknown-icon" } }, { in_use: "emoji", emoji: {} }])(
  "falls back to a work item icon for missing or invalid logo %j",
  (logo_props) => {
    const { container } = render(<TypesLogo type={{ logo_props }} />);
    expect(screen.queryByTestId("logo")).toBeNull();
    expect(container.querySelector("svg")?.style.width).toBe("20px");
    expect(container.textContent).toBe("");
  }
);

it.each(["Bug", "circle"])("separates the table glyph from its background for %s", (name) => {
  render(
    <TypesLogo
      type={{ logo_props: { in_use: "icon", icon: { name, color: "#ff0000", background_color: "#ffeeee" } } }}
      size={14}
      backgroundSize={20}
    />
  );
  const logo = screen.getByTestId("logo");
  expect(logo.getAttribute("data-icon-size")).toBe("14");
  expect(logo.getAttribute("data-background")).toBe("false");
  expect(logo.parentElement?.style.width).toBe("20px");
  expect(logo.parentElement?.style.height).toBe("20px");
  expect(logo.parentElement?.style.backgroundColor).toBe("rgb(255, 238, 238)");
});

it.each([
  {},
  { in_use: "icon", icon: { name: "Bug" } },
  { in_use: "icon", icon: { name: "Bug", background_color: "transparent" } },
  { in_use: "emoji", emoji: { value: "128027" } },
])("provides a default background when no background is selected: %j", (logo_props) => {
  const { container } = render(<TypesLogo type={{ logo_props }} size={14} backgroundSize={20} />);
  const wrapper = container.firstElementChild as HTMLElement;
  expect(wrapper.classList.contains("bg-layer-3")).toBe(true);
  expect(wrapper.style.backgroundColor).not.toBe("transparent");
  expect(wrapper.style.width).toBe("20px");
});

it("preserves emoji rendering", () => {
  render(<TypesLogo type={{ logo_props: { in_use: "emoji", emoji: { value: "128027" } } }} />);
  expect(screen.getByTestId("logo").getAttribute("data-icon-size")).toBe("20");
});
