import { createRef } from "react";
import { cleanup, fireEvent, render, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import usePeekOverviewOutsideClickDetector from "./use-peek-overview-outside-click";

afterEach(cleanup);

it("replaces a peek from another card without first dismissing it during mousedown", () => {
  const panel = createRef<HTMLDivElement>();
  const select = vi.fn();
  const view = render(
    <>
      <div ref={panel}>Current issue</div>
      <button type="button" data-issue-peek-trigger onClick={() => select("second")}>
        <span>Second issue</span>
      </button>
    </>
  );
  renderHook(() => usePeekOverviewOutsideClickDetector(panel, () => select(undefined), "first"));
  const target = view.getByText("Second issue");
  fireEvent.mouseDown(target);
  fireEvent.mouseUp(target);
  fireEvent.click(target);
  expect(select.mock.calls).toEqual([["second"]]);
});

it("keeps the peek open for protected editor layers while dismissing ordinary outside clicks", () => {
  const ref = createRef<HTMLDivElement>();
  const close = vi.fn();
  const view = render(
    <>
      <div ref={ref}>Issue details</div>
      <div data-prevent-outside-click>
        <button type="button">Bold</button>
      </div>
      <button type="button">Outside</button>
    </>
  );
  renderHook(() => usePeekOverviewOutsideClickDetector(ref, close, "issue"));
  fireEvent.mouseDown(view.getByText("Bold"));
  expect(close).not.toHaveBeenCalled();
  fireEvent.mouseDown(view.getByText("Outside"));
  expect(close).toHaveBeenCalledOnce();
});
