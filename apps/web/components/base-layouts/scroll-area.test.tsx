import { createRef, StrictMode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { expect, it } from "vitest";
import { OverlayScrollbars } from "overlayscrollbars";
import { LayoutScrollArea } from "./scroll-area";

it.each(["horizontal", "vertical"] as const)(
  "keeps the %s viewport stable and destroys its scrollbar on unmount",
  async (axis) => {
    const viewportRef = createRef<HTMLDivElement>();
    const { rerender, unmount } = render(
      <StrictMode>
        <LayoutScrollArea axis={axis} viewportRef={viewportRef}>
          <button>First card</button>
        </LayoutScrollArea>
      </StrictMode>
    );
    const viewport = viewportRef.current!;
    const host = viewport.parentElement!;
    await waitFor(() => expect(host.querySelectorAll(".os-scrollbar")).toHaveLength(2));
    const instance = OverlayScrollbars(host)!;
    expect(instance.elements().viewport).toBe(viewport);
    expect(instance.options().overflow).toEqual({
      x: axis === "horizontal" ? "scroll" : "hidden",
      y: axis === "vertical" ? "scroll" : "hidden",
    });
    expect(instance.options().scrollbars).toMatchObject({
      theme: "os-theme-plane",
      autoHide: "never",
      visibility: "auto",
      dragScroll: true,
    });
    expect(viewport.contains(screen.getByRole("button", { name: "First card" }))).toBe(true);
    rerender(
      <StrictMode>
        <LayoutScrollArea axis={axis} viewportRef={viewportRef}>
          <button>Updated card</button>
        </LayoutScrollArea>
      </StrictMode>
    );
    expect(viewportRef.current).toBe(viewport);
    expect(viewport.contains(screen.getByRole("button", { name: "Updated card" }))).toBe(true);
    expect(OverlayScrollbars(host)).toBe(instance);
    unmount();
    expect(instance.state().destroyed).toBe(true);
    expect(host.querySelectorAll(".os-scrollbar")).toHaveLength(0);
  }
);
