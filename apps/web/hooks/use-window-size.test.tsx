import { act, renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { expect, it, vi } from "vitest";
import useSize from "./use-window-size";

it("provides a stable server snapshot without reading window", () => {
  function Size() {
    return <span>{useSize().join(",")}</span>;
  }
  vi.stubGlobal("window", undefined);
  try {
    expect(renderToString(<Size />)).toBe("<span>0,0</span>");
  } finally {
    vi.unstubAllGlobals();
  }
});

it("tracks resizing and removes its listener on unmount", () => {
  const removeListener = vi.spyOn(window, "removeEventListener");
  const { result, unmount } = renderHook(() => useSize());
  expect(result.current).toEqual([window.innerWidth, window.innerHeight]);
  const originalWidth = window.innerWidth;
  try {
    act(() => {
      window.innerWidth = originalWidth + 100;
      window.dispatchEvent(new Event("resize"));
    });
    expect(result.current).toEqual([originalWidth + 100, window.innerHeight]);
    unmount();
    expect(removeListener).toHaveBeenCalledWith("resize", expect.any(Function));
  } finally {
    window.innerWidth = originalWidth;
    removeListener.mockRestore();
  }
});
