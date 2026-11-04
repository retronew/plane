import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { CommentComposer } from "./comment-composer";

it("focuses body and footer whitespace, while leaving actual controls independent", () => {
  const focus = vi.fn();
  const submit = vi.fn();
  const view = render(
    <CommentComposer
      onFocusInput={focus}
      footer={
        <div role="toolbar">
          <span data-testid="footer-space" />
          <button aria-label="Submit comment" onClick={submit}>
            <svg data-testid="submit-icon" />
          </button>
        </div>
      }
    >
      <textarea aria-label="Comment" defaultValue="Keep this text" />
    </CommentComposer>
  );
  for (const target of [
    view.container.firstElementChild!,
    view.container.querySelector("[data-comment-composer-body]")!,
    screen.getByTestId("footer-space"),
    screen.getByRole("toolbar"),
  ]) {
    fireEvent.mouseDown(target, { button: 0 });
  }
  expect(focus).toHaveBeenCalledTimes(4);
  focus.mockClear();
  fireEvent.mouseDown(screen.getByRole("textbox"), { button: 0 });
  fireEvent.mouseDown(screen.getByTestId("submit-icon"), { button: 0 });
  expect(focus).not.toHaveBeenCalled();
  expect(submit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByTestId("submit-icon"));
  expect(submit).toHaveBeenCalledOnce();
});

it("does not activate a disabled composer or respond to secondary mouse buttons", () => {
  const focus = vi.fn();
  const view = render(<CommentComposer onFocusInput={focus}>Input</CommentComposer>);
  fireEvent.mouseDown(view.container.firstElementChild!, { button: 2 });
  expect(focus).not.toHaveBeenCalled();
  view.rerender(
    <CommentComposer disabled onFocusInput={focus}>
      Input
    </CommentComposer>
  );
  fireEvent.mouseDown(view.container.firstElementChild!, { button: 0 });
  expect(focus).not.toHaveBeenCalled();
});

it("ignores the ancestor dialog when focusing an embedded composer", () => {
  const focus = vi.fn();
  const view = render(
    <dialog open>
      <CommentComposer onFocusInput={focus}>Input</CommentComposer>
    </dialog>
  );
  fireEvent.mouseDown(view.container.querySelector("[data-comment-composer]")!, { button: 0 });
  expect(focus).toHaveBeenCalledOnce();
});
