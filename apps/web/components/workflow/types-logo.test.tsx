import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { TypesLogo } from "./types-logo";

vi.mock("@plane/blocks/emoji-icon-picker", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@plane/blocks/emoji-icon-picker")>();
  return {
    ...actual,
    Logo: ({
      type,
      size,
      background,
      logo,
    }: {
      type?: string;
      size: number;
      background?: boolean;
      logo?: { icon?: { color?: string } };
    }) => (
      <span
        data-testid="logo"
        data-icon-type={type}
        data-icon-size={size}
        data-background={background}
        data-color={logo?.icon?.color}
      />
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
      type={{ logo_props: { in_use: "icon", icon: { name, color: "#ffffff", background_color: "#6695FF" } } }}
      size={14}
      backgroundSize={20}
    />
  );
  const logo = screen.getByTestId("logo");
  expect(logo.getAttribute("data-icon-size")).toBe("14");
  expect(logo.getAttribute("data-background")).toBe("false");
  expect(logo.parentElement?.style.width).toBe("20px");
  expect(logo.parentElement?.style.height).toBe("20px");
  expect(logo.parentElement?.style.backgroundColor).toBe("rgba(102, 149, 255, 0.25)");
  expect(logo.getAttribute("data-color")).toBe("#6695ff");
});

it.each([{}, { in_use: "icon", icon: { name: "Bug" } }])(
  "uses the hosted neutral tint for a type with no configured color: %j",
  (logo_props) => {
    const { container } = render(<TypesLogo type={{ logo_props }} size={14} backgroundSize={20} />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.backgroundColor).toMatch(/^rgba\(.+, 0\.25\)$/);
    expect(wrapper.style.width).toBe("20px");
  }
);
it("uses the original hosted 24px work-item glyph rather than the newer Propel glyph", () => {
  const { container } = render(<TypesLogo type={{}} size={14} backgroundSize={20} />);
  expect(container.querySelector("svg")?.getAttribute("viewBox")).toBe("0 0 24 24");
  expect(container.querySelector("svg")?.getAttribute("stroke-width")).toBe("2");
  expect(container.querySelectorAll("svg path")).toHaveLength(3);
});
it("preserves an explicitly transparent custom background", () => {
  const { container } = render(
    <TypesLogo type={{ logo_props: { in_use: "icon", icon: { name: "Bug", background_color: "transparent" } } }} />
  );
  expect((container.firstElementChild as HTMLElement).style.backgroundColor).toBe("transparent");
});

it("preserves emoji rendering", () => {
  render(<TypesLogo type={{ logo_props: { in_use: "emoji", emoji: { value: "128027" } } }} />);
  expect(screen.getByTestId("logo").getAttribute("data-icon-size")).toBe("20");
});
