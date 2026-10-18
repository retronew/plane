/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EmojiReactionPicker } from "./emoji-reaction-picker";
import { EmojiReactionGroup } from "./emoji-reaction";

vi.mock("../emoji-icon-picker/emoji/emoji", () => ({
  EmojiRoot: () => (
    <div data-testid="emoji-grid">
      <div data-slot="emoji-picker-search-header">
        search
        <button type="button" data-slot="emoji-picker-skin-tone-selector" aria-label="Change skin tone" />
      </div>
      <div data-slot="emoji-picker-content">emoji grid</div>
    </div>
  ),
}));

function ControlledPicker({ tooltip }: { tooltip?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <EmojiReactionPicker
      isOpen={isOpen}
      handleToggle={setIsOpen}
      onChange={vi.fn()}
      tooltip={tooltip}
      label={tooltip ? <svg aria-hidden="true" /> : <span>Add reaction</span>}
    />
  );
}

describe("EmojiReactionGroup", () => {
  it("preserves the focused reaction when reactions are reordered or removed", () => {
    const first = { emoji: "128077", count: 1 };
    const second = { emoji: "128512", count: 2 };
    const { container, rerender } = render(<EmojiReactionGroup reactions={[first, second]} showAddButton={false} />);
    const button = container.querySelectorAll("button")[1];
    button.focus();
    rerender(<EmojiReactionGroup reactions={[second, first]} showAddButton={false} />);
    expect(container.querySelectorAll("button")[0]).toBe(button);
    expect(document.activeElement).toBe(button);
    rerender(<EmojiReactionGroup reactions={[second]} showAddButton={false} />);
    expect(document.activeElement).toBe(button);
  });
});

describe("EmojiReactionPicker popover", () => {
  it("anchors a named tooltip and the picker to the same icon button", async () => {
    const user = userEvent.setup();
    render(<ControlledPicker tooltip="Add reaction" />);
    const trigger = screen.getByRole("button", { name: "Add reaction" });
    expect(trigger.querySelector("button")).toBeNull();
    await user.hover(trigger);
    expect(await screen.findByRole("tooltip")).toHaveProperty("textContent", "Add reaction");
    await user.click(trigger);
    expect(await screen.findByTestId("emoji-grid")).toBeDefined();
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("opens on trigger click and marks the panel as preventing outside click", async () => {
    const user = userEvent.setup();
    render(<ControlledPicker />);
    expect(document.querySelector("[data-prevent-outside-click]")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Add reaction" }));
    expect(await screen.findByTestId("emoji-grid")).toBeDefined();
    expect(document.querySelector("[data-prevent-outside-click]")).not.toBeNull();
  });

  it("removes outer insets and the search top border while keeping a thin transparent scroll track", async () => {
    const { readFileSync } = await vi.importActual<{ readFileSync: (path: string, encoding: "utf8") => string }>(
      "node:fs"
    );
    const style = document.createElement("style");
    style.textContent = readFileSync("../tailwind-config/emoji-picker.css", "utf8");
    document.head.append(style);

    try {
      render(
        <EmojiReactionPicker isOpen handleToggle={vi.fn()} onChange={vi.fn()} label={<span>Add reaction</span>} />
      );
      const grid = screen.getByTestId("emoji-grid");
      const popup = grid.closest("[data-emoji-reaction-picker-popup]");
      const body = grid.closest("[data-emoji-reaction-picker-body]");
      expect(popup).not.toBeNull();
      expect(body).not.toBeNull();
      expect(getComputedStyle(popup!).padding).toBe("0px");
      expect(getComputedStyle(body!).padding).toBe("0px");
      expect(getComputedStyle(body!).margin).toBe("0px");
      expect(getComputedStyle(body!).overflow).toBe("hidden");
      expect(getComputedStyle(body!.firstElementChild!).padding).toBe("0px");
      expect(getComputedStyle(body!.firstElementChild!).margin).toBe("0px");
      expect(getComputedStyle(grid.querySelector('[data-slot="emoji-picker-search-header"]')!).borderTopWidth).toBe(
        "0px"
      );
      expect(getComputedStyle(grid.querySelector('[data-slot="emoji-picker-search-header"]')!).paddingRight).toBe(
        "0px"
      );
      expect(getComputedStyle(screen.getByRole("button", { name: "Change skin tone" })).marginRight).toBe("8px");
      const scrollportStyle = getComputedStyle(grid.querySelector('[data-slot="emoji-picker-content"]')!);
      expect(scrollportStyle.getPropertyValue("scrollbar-width")).toBe("thin");
      expect(scrollportStyle.getPropertyValue("scrollbar-color")).toBe("var(--scrollbar-thumb) transparent");
    } finally {
      style.remove();
    }
  });

  it("keeps the prevent-outside panel while open and drops it when closed", () => {
    const handleToggle = vi.fn();
    const { rerender } = render(
      <EmojiReactionPicker isOpen handleToggle={handleToggle} onChange={vi.fn()} label={<span>Add reaction</span>} />
    );
    expect(document.querySelector("[data-prevent-outside-click]")).not.toBeNull();
    rerender(
      <EmojiReactionPicker
        isOpen={false}
        handleToggle={handleToggle}
        onChange={vi.fn()}
        label={<span>Add reaction</span>}
      />
    );
    const panel = document.querySelector("[data-prevent-outside-click]");
    expect(panel == null || panel.hasAttribute("data-closed")).toBe(true);
  });
});
