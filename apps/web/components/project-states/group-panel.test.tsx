import { render, screen, fireEvent } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { StateGroupPanel } from "./group-panel";
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
it("shows a switch that enables or disables new work items for the whole group", () => {
  const change = vi.fn();
  render(
    <StateGroupPanel title="Backlog" onAdd={vi.fn()} allowNewWorkItems={{ checked: true, onChange: change }}>
      <p>Todo</p>
    </StateGroupPanel>
  );
  const toggle = screen.getByRole("switch", { name: "web.allow_new_work_items" });
  expect(toggle.getAttribute("aria-checked")).toBe("true");
  // jsdom has no PointerEvent, which the switch requires to register a click.
  class TestPointerEvent extends MouseEvent {
    pointerId = 1;
    pointerType = "mouse";
  }
  globalThis.PointerEvent = TestPointerEvent as unknown as typeof PointerEvent;
  toggle.dispatchEvent(new TestPointerEvent("click", { bubbles: true }));
  expect(change.mock.calls[0][0]).toBe(false);
});
it("keeps states visible and exposes only the add action in the group heading", () => {
  const add = vi.fn();
  render(
    <StateGroupPanel title="Planning" onAdd={add}>
      <input aria-label="Draft" defaultValue="Unfinished state" />
    </StateGroupPanel>
  );
  expect(screen.getByRole("heading", { name: "Planning" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Planning" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "common.add Planning" }));
  expect(add).toHaveBeenCalledTimes(1);
  expect((screen.getByRole("textbox", { name: "Draft" }) as HTMLInputElement).value).toBe("Unfinished state");
});
