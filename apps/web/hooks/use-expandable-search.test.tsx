import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useExpandableSearch } from "./use-expandable-search";

describe("expandable search", () => {
  it("opens on keyboard focus and reopens on a click after closing", () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useExpandableSearch({ onClose }));
    act(() => result.current.handleFocus());
    expect(result.current.isOpen).toBe(true);
    act(() => result.current.handleClose());
    expect(result.current.isOpen).toBe(false);
    expect(onClose).toHaveBeenCalledOnce();
    act(() => result.current.handleMouseDown());
    expect(result.current.isOpen).toBe(true);
  });
  it("closes with Escape when focus is in the result list", () => {
    const { result } = renderHook(() => useExpandableSearch());
    act(() => result.current.openPanel());
    act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(result.current.isOpen).toBe(false);
  });
});
