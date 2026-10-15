import { render, screen, within } from "@testing-library/react";
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
