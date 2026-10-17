import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { StateSelect } from "./state-select";
import type { StateOption } from "./state-select";

it("renders the same group progress and custom color in the trigger and menu", async () => {
  const state: StateOption = { id: "review", name: "Review", group: "unstarted", color: "#8B5CF6", percentage: 50 };
  render(
    <StateSelect
      getValues={async () => ({ results: [state], next_page_results: false })}
      value={state}
      onChange={vi.fn()}
      variant="pill-md"
    />
  );
  const trigger = screen.getByRole("button", { name: "Review" });
  const triggerCircle = trigger.querySelector("circle");
  const expectedOffset = 2 * Math.PI * 6 * 0.5;
  expect(Number(triggerCircle?.getAttribute("stroke-dashoffset"))).toBeCloseTo(expectedOffset);
  expect(triggerCircle?.getAttribute("stroke")).toBe("#8B5CF6");

  await userEvent.setup().click(trigger);
  const option = await screen.findByRole("option", { name: "Review" });
  expect(Number(option.querySelector("circle")?.getAttribute("stroke-dashoffset"))).toBeCloseTo(expectedOffset);
  expect(option.querySelector("circle")?.getAttribute("stroke")).toBe("#8B5CF6");
});
