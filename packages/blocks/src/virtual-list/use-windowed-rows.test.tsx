import { useRef } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useWindowedRows } from "./use-windowed-rows";

const key = (index: number) => `item-${index}`;
function List({ offset = 0 }: { offset?: number }) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const { virtualizer, scrollMargin } = useWindowedRows({
    count: 5000,
    estimateSize: 48,
    getItemKey: key,
    scrollRef,
    contentRef,
  });
  return (
    <div ref={scrollRef} data-testid="viewport" style={{ height: 240, overflow: "auto" }}>
      <div style={{ height: offset }} />
      <div
        ref={contentRef}
        data-testid="content"
        data-offset={offset}
        style={{ position: "relative", height: virtualizer.getTotalSize() }}
      >
        {virtualizer.getVirtualItems().map((row) => (
          <div
            key={row.key}
            data-virtual-index={row.index}
            data-index={row.index}
            ref={virtualizer.measureElement}
            style={{ height: 48, position: "absolute", top: row.start - scrollMargin }}
          >
            <button>Row {row.index}</button>
          </div>
        ))}
      </div>
    </div>
  );
}
function layout() {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const top =
      this.dataset.testid === "content" ? Number(this.dataset.offset) - (this.parentElement?.scrollTop ?? 0) : 0;
    return DOMRect.fromRect({ x: 0, y: top, width: 256, height: this.dataset.index !== undefined ? 48 : 240 });
  });
}
afterEach(() => vi.restoreAllMocks());
it("keeps 5000 rows bounded, preserves total scroll height, and renders rows reached by scrolling", async () => {
  layout();
  const { container } = render(<List />);
  await screen.findByRole("button", { name: "Row 0" });
  expect(container.querySelectorAll("[data-virtual-index]").length).toBeLessThan(40);
  expect(screen.getByTestId("content").style.height).toBe("240000px");
  act(() => {
    screen.getByTestId("viewport").scrollTop = 48000;
  });
  await screen.findByRole("button", { name: "Row 1000" });
  expect(screen.queryByRole("button", { name: "Row 0" })).toBeNull();
  expect(container.querySelectorAll("[data-virtual-index]").length).toBeLessThan(40);
});
it("retains a focused or open-menu row outside the scroll window", async () => {
  layout();
  render(<List />);
  const button = await screen.findByRole("button", { name: "Row 0" });
  button.focus();
  act(() => {
    screen.getByTestId("viewport").scrollTop = 48000;
  });
  await screen.findByRole("button", { name: "Row 1000" });
  expect(screen.getByRole("button", { name: "Row 0" })).toBe(button);
  button.blur();
  button.setAttribute("aria-expanded", "true");
  act(() => {
    screen.getByTestId("viewport").scrollTop = 96000;
  });
  await screen.findByRole("button", { name: "Row 2000" });
  expect(screen.getByRole("button", { name: "Row 0" })).toBe(button);
  button.removeAttribute("aria-expanded");
  act(() => {
    screen.getByTestId("viewport").scrollTop = 144000;
  });
  await waitFor(() => expect(screen.queryByRole("button", { name: "Row 0" })).toBeNull());
});
it("accounts for a preceding group in a shared scroll container", async () => {
  layout();
  render(<List offset={48000} />);
  act(() => {
    screen.getByTestId("viewport").scrollTop = 48000;
  });
  await screen.findByRole("button", { name: "Row 0" });
  expect(screen.queryByRole("button", { name: "Row 1000" })).toBeNull();
});
