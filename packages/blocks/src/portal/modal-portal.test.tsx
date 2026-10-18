import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setLanguage } from "@plane/i18n";
import { ModalPortal } from "./modal-portal";

afterEach(async () => {
  await act(async () => {
    await setLanguage("en");
  });
});

describe("ModalPortal", () => {
  it("uses a localized fallback and supports explicit names and descriptions", async () => {
    await setLanguage("zh-CN");
    const { rerender } = render(
      <ModalPortal isOpen>
        <h2 id="title">Project details</h2>
        <p id="description">Summary</p>
      </ModalPortal>
    );
    const dialog = screen.getByRole("dialog", { name: "弹窗" });
    expect(dialog.tagName).toBe("DIALOG");
    expect(dialog.hasAttribute("open")).toBe(true);
    rerender(
      <ModalPortal isOpen aria-label="Edit project">
        Content
      </ModalPortal>
    );
    expect(screen.getByRole("dialog", { name: "Edit project" })).toBeDefined();
    rerender(
      <ModalPortal isOpen aria-labelledby="title" aria-describedby="description">
        <h2 id="title">Project details</h2>
        <p id="description">Summary</p>
      </ModalPortal>
    );
    expect(screen.getByRole("dialog", { name: "Project details" }).getAttribute("aria-describedby")).toBe(
      "description"
    );
    await act(async () => {
      await setLanguage("en");
    });
    rerender(<ModalPortal isOpen>Content</ModalPortal>);
    expect(screen.getByRole("dialog", { name: "Modal" })).toBeDefined();
  });

  it("preserves document positioning and controlled Escape behavior", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <ModalPortal isOpen onClose={onClose}>
        <button>Inside</button>
      </ModalPortal>
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.classList.contains("m-0")).toBe(true);
    expect(dialog.classList.contains("p-0")).toBe(true);
    expect(dialog.style.zIndex).toBe("25");
    expect(screen.getByRole("button").parentElement?.classList.contains("right-0")).toBe(true);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.getByRole("dialog")).toBeDefined();
    rerender(
      <ModalPortal isOpen closeOnEscape={false} onClose={onClose}>
        Content
      </ModalPortal>
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
    const cancel = new Event("cancel", { cancelable: true });
    dialog.dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(true);
    rerender(<ModalPortal isOpen={false}>Content</ModalPortal>);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps outside dismissal opt-in and ignores clicks inside the panel", () => {
    const outside = vi.fn();
    const close = vi.fn();
    const { rerender } = render(
      <ModalPortal isOpen onClose={close}>
        <button>Inside</button>
      </ModalPortal>
    );
    fireEvent.mouseDown(screen.getByRole("dialog"));
    expect(close).not.toHaveBeenCalled();
    rerender(
      <ModalPortal isOpen onOutsideClick={outside}>
        <button>Inside</button>
      </ModalPortal>
    );
    fireEvent.mouseDown(screen.getByRole("button"));
    expect(outside).not.toHaveBeenCalled();
    fireEvent.mouseDown(screen.getByRole("dialog"));
    expect(outside).toHaveBeenCalledOnce();
  });

  it("only closes the topmost modal on Escape", () => {
    const first = vi.fn();
    const second = vi.fn();
    render(
      <>
        <ModalPortal isOpen onClose={first}>
          First
        </ModalPortal>
        <ModalPortal isOpen onClose={second}>
          Second
        </ModalPortal>
      </>
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });
});
