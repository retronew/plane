/* oxlint-disable jsx-a11y/no-noninteractive-element-interactions -- Keyboard-navigation fixture. */
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useTableKeyboardNavigation } from "./use-table-keyboard-navigation";
const scrollDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");
beforeEach(() =>
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() })
);
afterEach(() => {
  if (scrollDescriptor) Object.defineProperty(HTMLElement.prototype, "scrollIntoView", scrollDescriptor);
  else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
});
function Table({ gap = false, navigate }: { gap?: boolean; navigate?: (index: number, column: number) => void }) {
  const onKeyDown = useTableKeyboardNavigation(navigate);
  return (
    <table onKeyDown={onKeyDown}>
      <thead>
        <tr>
          <th tabIndex={0}>Title</th>
        </tr>
      </thead>
      <tbody data-virtual-index="0">
        <tr>
          <td tabIndex={0}>First</td>
        </tr>
        <tr>
          <td tabIndex={0}>Child</td>
        </tr>
      </tbody>
      <tbody aria-hidden>
        <tr data-virtual-spacer>
          <td aria-label="Virtual spacer" style={{ height: 100 }} />
        </tr>
      </tbody>
      <tbody data-virtual-index={gap ? 20 : 1}>
        <tr>
          <td tabIndex={0}>Second</td>
        </tr>
      </tbody>
    </table>
  );
}
it("navigates between row groups and expanded children while skipping virtual spacers", () => {
  render(<Table />);
  const first = screen.getByText("First"),
    child = screen.getByText("Child"),
    second = screen.getByText("Second");
  first.focus();
  fireEvent.keyDown(first, { key: "ArrowDown" });
  expect(document.activeElement).toBe(child);
  fireEvent.keyDown(child, { key: "ArrowDown" });
  expect(document.activeElement).toBe(second);
  fireEvent.keyDown(second, { key: "ArrowUp" });
  expect(document.activeElement).toBe(child);
});
it("requests the adjacent virtual row when a pinned focused row is far from the viewport", () => {
  const navigate = vi.fn();
  render(<Table gap navigate={navigate} />);
  fireEvent.keyDown(screen.getByText("Child"), { key: "ArrowDown" });
  expect(navigate).toHaveBeenCalledExactlyOnceWith(1, 0);
});
