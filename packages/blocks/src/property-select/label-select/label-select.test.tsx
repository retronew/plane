import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LabelSelect } from "./label-select";
import type { LabelOption } from "./label-select";

const getValues = async () => ({ results: [], next_page_results: false, count: 0, total_count: 0 });

describe("label color slots", () => {
  it.each([undefined, null, "", "   "])("omits the marker for an unset color (%s)", (color) => {
    render(
      <LabelSelect
        variant="pill-md"
        value={[{ id: "a", name: "No color", color }]}
        getValues={getValues}
        onChange={vi.fn()}
      />
    );
    const trigger = screen.getByRole("button", { name: "No color" });
    expect(trigger.querySelector('[style*="background-color"]')).toBeNull();
    expect(trigger.querySelector(".rounded-full")).toBeNull();
    expect(within(trigger).getByText("No color")).toBeDefined();
  });

  it("preserves explicit colors including white", () => {
    render(
      <LabelSelect
        variant="select-md"
        value={[
          { id: "a", name: "White", color: "#ffffff" },
          { id: "b", name: "Blue", color: "#0000ff" },
        ]}
        getValues={getValues}
        onChange={vi.fn()}
      />
    );
    const dots = screen.getByRole("button").querySelectorAll<HTMLElement>('[style*="background-color"]');
    expect(Array.from(dots).map((dot) => dot.style.backgroundColor)).toEqual(["rgb(255, 255, 255)", "rgb(0, 0, 255)"]);
    expect(
      Array.from(dots).every((dot) => dot.classList.contains("size-2") && dot.classList.contains("shrink-0"))
    ).toBe(true);
  });

  it("keeps an uncolored option selectable without an empty icon slot", async () => {
    const label: LabelOption = { id: "a", name: "No color", color: "" };
    const onChange = vi.fn();
    render(
      <LabelSelect
        variant="pill-md"
        value={[]}
        placeholder="Labels"
        getValues={async () => ({ results: [label], next_page_results: false, count: 1, total_count: 1 })}
        onChange={onChange}
      />
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Labels" }));
    const option = await screen.findByRole("option", { name: "No color" });
    expect(option.querySelector(".rounded-full")).toBeNull();
    await user.click(option);
    expect(onChange).toHaveBeenCalledWith(["a"]);
  });
});

it("uses compact module-sized chips in sidebar selects and retains the label color", () => {
  render(
    <LabelSelect
      variant="select-ghost-md"
      value={[{ id: "a", name: "Backend", color: "#123456" }]}
      getValues={getValues}
      onChange={vi.fn()}
    />
  );
  const chip = screen.getByText("Backend").parentElement;
  expect(chip?.className).toContain("h-5");
  expect(chip?.className).toContain("text-caption-md-medium");
  expect(chip?.className).toContain("max-w-full");
  expect(chip?.querySelector<HTMLElement>("[style]")?.style.backgroundColor).toBe("rgb(18, 52, 86)");
});

it("keeps the tag glyph visible in icon mode after selecting a label", () => {
  render(
    <LabelSelect
      variant="icon-md"
      value={[{ id: "a", name: "Backend", color: "#123456" }]}
      placeholder="Labels"
      getValues={getValues}
      onChange={vi.fn()}
    />
  );
  expect(screen.getByRole("button", { name: /Backend/ }).querySelector("svg")).not.toBeNull();
});

it("positions the board picker on the pressed chip and follows the remaining chip on removal", async () => {
  // The board's display:contents button has no layout box. Give each visible chip a distinct
  // width so the real positioner's computed --anchor-width identifies what it measured.
  const boxes = vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const width = this.classList.contains("bg-label-grey-bg") ? (this.textContent === "Backend" ? 64 : 88) : 0;
    return DOMRect.fromRect({ x: 300, y: 200, width, height: width ? 24 : 0 });
  });
  try {
    const labels = [
      { id: "a", name: "Backend" },
      { id: "b", name: "Frontend" },
    ];
    const props = { variant: "pill-md", showAllLabels: true, getValues, onChange: vi.fn() } as const;
    const user = userEvent.setup();
    const { rerender } = render(<LabelSelect {...props} value={labels} />);
    const anchorWidth = () => screen.getByRole("dialog").parentElement?.style.getPropertyValue("--anchor-width");

    await user.click(screen.getByText("Frontend"));
    await waitFor(() => expect(anchorWidth()).toBe("88px"));
    rerender(<LabelSelect {...props} value={[labels[0]]} />);
    await waitFor(() => expect(anchorWidth()).toBe("64px"));
    await user.keyboard("{Escape}");
    rerender(<LabelSelect {...props} value={labels} />);
    await user.click(screen.getByText("Backend"));
    await waitFor(() => expect(anchorWidth()).toBe("64px"));
  } finally {
    boxes.mockRestore();
  }
});

it("dismisses the open board picker when its chip scrolls out of the column", async () => {
  const intersections = new Map<Element, (visible: boolean) => void>();
  class ChipObserver extends IntersectionObserver {
    constructor(callback: IntersectionObserverCallback) {
      super(callback);
      this.observe = (element) => {
        intersections.set(element, (isIntersecting) => {
          callback([{ target: element, isIntersecting } as IntersectionObserverEntry], this);
        });
      };
    }
  }
  vi.stubGlobal("IntersectionObserver", ChipObserver);
  try {
    render(
      <LabelSelect
        variant="pill-md"
        showAllLabels
        value={[{ id: "b", name: "Frontend" }]}
        getValues={getValues}
        onChange={vi.fn()}
      />
    );
    await userEvent.setup().click(screen.getByText("Frontend"));
    const chip = screen.getByText("Frontend").parentElement!;
    expect(intersections.has(chip)).toBe(true);
    act(() => intersections.get(chip)!(true));
    expect(screen.getByRole("dialog")).toBeDefined();
    act(() => intersections.get(chip)!(false));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  } finally {
    vi.unstubAllGlobals();
  }
});

it("names each chip on hover when every label is shown", async () => {
  render(
    <LabelSelect
      variant="pill-md"
      showAllLabels
      value={[
        { id: "a", name: "Backend", color: "#123456" },
        { id: "b", name: "Frontend", color: "#654321" },
      ]}
      getValues={getValues}
      onChange={vi.fn()}
    />
  );
  await userEvent.setup().hover(screen.getByText("Frontend"));
  expect(await screen.findByRole("tooltip")).toBeDefined();
  expect(within(screen.getByRole("tooltip")).getByText("Labels")).toBeDefined();
});
