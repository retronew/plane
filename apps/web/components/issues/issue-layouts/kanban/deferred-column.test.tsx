/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DeferredKanbanColumn } from "./deferred-column";

function setup() {
  let notify!: (visible: boolean) => void;
  const disconnect = vi.fn();
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
        notify = (visible) => callback([{ isIntersecting: visible }]);
      }
      observe = vi.fn();
      disconnect = disconnect;
    }
  );
  render(
    <DeferredKanbanColumn className="w-[336px]" name="Project A">
      <input defaultValue="Card" />
    </DeferredKanbanColumn>
  );
  return { notify, disconnect };
}

afterEach(() => vi.unstubAllGlobals());

it("reserves a column without mounting offscreen cards, then keeps visited content and its state", () => {
  const { notify, disconnect } = setup();
  act(() => notify(false));
  expect(screen.queryByRole("textbox")).toBeNull();
  act(() => notify(true));
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Draft" } });
  act(() => notify(false));
  expect(screen.getByDisplayValue("Draft")).toBeTruthy();
  expect(disconnect).toHaveBeenCalled();
});

it("lets keyboard focus reveal an unvisited column", () => {
  setup();
  const column = screen.getByRole("button", { name: "Project A" });
  expect(column.tabIndex).toBe(0);
  fireEvent.focus(column);
  expect(screen.getByRole("textbox")).toBeTruthy();
});
