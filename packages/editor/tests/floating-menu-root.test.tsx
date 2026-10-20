import { StrictMode, useCallback, useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useFloating, useInteractions } from "@floating-ui/react";
import { afterEach, expect, it, vi } from "vitest";
import { FloatingMenuRoot } from "../src/components/menus/floating-menu/root";

afterEach(cleanup);

function Menu({
  revision,
  onReferenceChange,
}: {
  revision: number;
  onReferenceChange?: (node: Element | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const options = useFloating({ open, onOpenChange: setOpen });
  const { getFloatingProps, getReferenceProps } = useInteractions([]);
  const { setReference } = options.refs;
  const trackReference = useCallback(
    (node: Element | null) => {
      onReferenceChange?.(node);
      setReference(node);
    },
    [onReferenceChange, setReference]
  );

  return (
    <FloatingMenuRoot
      options={{ ...options, refs: { ...options.refs, setReference: trackReference } }}
      getFloatingProps={getFloatingProps}
      getReferenceProps={getReferenceProps}
      menuButton="Toggle menu"
    >
      <span>Menu revision {revision}</span>
    </FloatingMenuRoot>
  );
}

it("keeps Floating UI refs stable across rerenders and repeated open/close cycles", () => {
  const onReferenceChange = vi.fn();
  const view = render(
    <StrictMode>
      <Menu revision={0} onReferenceChange={onReferenceChange} />
    </StrictMode>
  );
  const button = screen.getByRole("button", { name: "Toggle menu" });

  for (let revision = 1; revision <= 3; revision++) {
    fireEvent.click(button);
    expect(screen.getByText(`Menu revision ${revision - 1}`)).toBeTruthy();
    onReferenceChange.mockClear();
    view.rerender(
      <StrictMode>
        <Menu revision={revision} onReferenceChange={onReferenceChange} />
      </StrictMode>
    );
    // An unchanged button must not detach/reattach its reference on a parent update.
    // A null/node pair here feeds state updates back into Floating UI during commit.
    expect(onReferenceChange).not.toHaveBeenCalled();
    expect(screen.getByText(`Menu revision ${revision}`)).toBeTruthy();
    fireEvent.click(button);
    expect(screen.queryByText(`Menu revision ${revision}`)).toBeNull();
  }

  view.unmount();
});
