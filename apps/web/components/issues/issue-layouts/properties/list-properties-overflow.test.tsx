import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ListPropertiesOverflow } from "./list-properties-overflow";
import { WithDisplayPropertiesHOC } from "./with-display-properties-HOC";

const animation = vi.hoisted(() => ({ defer: false, complete: undefined as ((open: boolean) => void) | undefined }));
vi.mock("@makeplane/propel/components/popover", async (importOriginal) => {
  const original = await importOriginal<typeof import("@makeplane/propel/components/popover")>();
  return {
    ...original,
    Popover: ({ onOpenChangeComplete, ...props }: import("react").ComponentProps<typeof original.Popover>) => {
      animation.complete = onOpenChangeComplete;
      return <original.Popover {...props} onOpenChangeComplete={animation.defer ? undefined : onOpenChangeComplete} />;
    },
  };
});
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: () => "属性" }) }));
let rowWidth = 1400;
let direction = "row";
const observers: { callback: () => void; disconnect: ReturnType<typeof vi.fn> }[] = [];
beforeEach(() => {
  rowWidth = 1400;
  direction = "row";
  animation.defer = false;
  animation.complete = undefined;
  observers.length = 0;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      disconnect = vi.fn();
      constructor(callback: () => void) {
        observers.push({ callback, disconnect: this.disconnect });
      }
      observe() {}
    }
  );
  const getStyle = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((element) => {
    const style = getStyle(element);
    if (element.hasAttribute("data-issue-list-row"))
      Object.defineProperty(style, "flexDirection", { value: direction });
    return style;
  });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    return { width: this.hasAttribute("data-issue-list-row") ? rowWidth : 100, height: 24 } as DOMRect;
  });
  Element.prototype.getAnimations ??= () => [];
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function show(enabled = true) {
  return render(
    <div data-issue-list-row="">
      <ListPropertiesOverflow className="flex gap-2" enabled={enabled}>
        {["状态", "优先级", "日期", "负责人", "周期", "标签"].map((name) => (
          <WithDisplayPropertiesHOC key={name} displayProperties={{ state: true }} displayPropertyKey="state">
            <button type="button">{name}</button>
          </WithDisplayPropertiesHOC>
        ))}
        <WithDisplayPropertiesHOC displayProperties={{ labels: false }} displayPropertyKey="labels">
          <button type="button">禁用的标签</button>
        </WithDisplayPropertiesHOC>
        <WithDisplayPropertiesHOC
          displayProperties={{ link: true }}
          displayPropertyKey="link"
          shouldRenderProperty={() => false}
        >
          <button type="button">空计数</button>
        </WithDisplayPropertiesHOC>
      </ListPropertiesOverflow>
    </div>
  );
}
function resize(width: number) {
  act(() => {
    rowWidth = width;
    observers.at(-1)!.callback();
  });
}
it("responds to row-only resize, keeps leading properties, and restores on expansion", () => {
  const viewportWidth = window.innerWidth;
  const { unmount } = show();
  expect(screen.queryByText(/^\+/)).toBeNull();
  resize(749);
  expect(window.innerWidth).toBe(viewportWidth);
  const overflow = screen.getByText("+4");
  expect(overflow.className).toContain("h-5");
  expect(overflow.className).toContain("rounded-lg");
  expect(overflow.className).not.toContain("h-6");
  expect(overflow.className).not.toContain("rounded-md");
  expect(screen.getByRole("button", { name: "状态" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "优先级" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "日期" })).toBeNull();
  expect(screen.queryByText("禁用的标签")).toBeNull();
  expect(screen.queryByText("空计数")).toBeNull();
  resize(1400);
  expect(screen.queryByText(/^\+/)).toBeNull();
  expect(screen.getByRole("button", { name: "日期" })).toBeTruthy();
  unmount();
  expect(observers.every((observer) => observer.disconnect.mock.calls.length > 0)).toBe(true);
});
it("opens overflow with the original controls and without interactive duplicates", async () => {
  show();
  resize(749);
  fireEvent.click(screen.getByText("+4"));
  expect(await screen.findByRole("button", { name: "日期" })).toBeTruthy();
  expect(screen.getAllByText("日期")).toHaveLength(1);
  expect(screen.getAllByText("负责人")).toHaveLength(1);
});
it("keeps controls in the popup until its closing animation completes", async () => {
  animation.defer = true;
  show();
  resize(749);
  fireEvent.click(screen.getByText("+4"));
  const control = await screen.findByRole("button", { name: "日期" });
  expect(control.closest("[data-list-property]")).toBeNull();
  fireEvent.click(screen.getByText("+4"));
  expect(document.querySelectorAll("[data-list-property]")).toHaveLength(2);
  act(() => animation.complete?.(false));
  expect(document.querySelectorAll("[data-list-property]")).toHaveLength(6);
  expect(screen.getAllByText("日期")).toHaveLength(1);
});
it("keeps one observer through overflow changes and repeated size notifications", () => {
  show();
  const initialObservers = observers.length;
  resize(749);
  expect(screen.getByText("+4")).toBeTruthy();
  expect(observers).toHaveLength(initialObservers);
  for (let index = 0; index < 20; index++) resize(749);
  expect(screen.getByText("+4")).toBeTruthy();
  expect(observers).toHaveLength(initialObservers);
  expect(observers.at(-1)!.disconnect).not.toHaveBeenCalled();
  resize(1400);
  expect(screen.queryByText(/^\+/)).toBeNull();
  expect(observers).toHaveLength(initialObservers);
});
it("remeasures replacement keys even when the number of properties stays the same", () => {
  rowWidth = 749;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    if (this.hasAttribute("data-list-property")) {
      return { width: this.textContent?.startsWith("new") ? 40 : 100, height: 20 } as DOMRect;
    }
    return { width: this.hasAttribute("data-issue-list-row") ? rowWidth : 100, height: 24 } as DOMRect;
  });
  const content = (prefix: string) => (
    <div data-issue-list-row="">
      <ListPropertiesOverflow className="flex" enabled>
        {[0, 1, 2, 3].map((index) => (
          <WithDisplayPropertiesHOC
            key={`${prefix}-${index}`}
            displayProperties={{ state: true }}
            displayPropertyKey="state"
          >
            <button type="button">
              {prefix}
              {index}
            </button>
          </WithDisplayPropertiesHOC>
        ))}
      </ListPropertiesOverflow>
    </div>
  );
  const { rerender } = render(content("old"));
  expect(screen.getByText("+2")).toBeTruthy();
  rerender(content("new"));
  expect(screen.queryByText(/^\+/)).toBeNull();
  expect(screen.getByRole("button", { name: "new3" })).toBeTruthy();
});
it("preserves the mobile stacked layout and non-list layouts", () => {
  direction = "column";
  rowWidth = 375;
  const { unmount } = show();
  expect(screen.queryByText(/^\+/)).toBeNull();
  expect(screen.getByRole("button", { name: "日期" })).toBeTruthy();
  unmount();
  direction = "row";
  show(false);
  expect(screen.queryByText(/^\+/)).toBeNull();
  expect(screen.getByRole("button", { name: "日期" })).toBeTruthy();
});
