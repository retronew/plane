/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type * as React from "react";
import { useRef } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent, { PointerEventsCheckLevel } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContextMenu } from "./context-menu";
import type { TContextMenuItem } from "./types";

type TVirtualAnchor = { getBoundingClientRect: () => DOMRect };

// Capture the positioning props the block hands Propel's surface while still rendering the real
// one, so the cursor-pinned anchor can be read back without depending on jsdom's (absent) layout.
const surface = vi.hoisted(() => ({ props: [] as Record<string, unknown>[] }));

vi.mock("@makeplane/propel/components/context-menu", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@makeplane/propel/components/context-menu")>();
  function ContextMenuContent(props: React.ComponentProps<typeof actual.ContextMenuContent>) {
    surface.props.push(props as Record<string, unknown>);
    return <actual.ContextMenuContent {...props} />;
  }
  return { ...actual, ContextMenuContent };
});

function Glyph() {
  return <svg data-testid="row-glyph" />;
}

/** The consumer owns the right-click target and hands its ref to the menu, like the board cards do. */
function Harness({
  items,
  onOuterContextMenu,
  onOuterClick,
}: {
  items: TContextMenuItem[];
  onOuterContextMenu?: () => void;
  onOuterClick?: (e: React.MouseEvent) => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  return (
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- stands in for a card `Link` wrapping the menu
    <div onContextMenu={onOuterContextMenu} onClick={onOuterClick}>
      <div ref={parentRef} data-testid="target">
        <span data-testid="target-child">Card title</span>
      </div>
      <div data-testid="outside">Somewhere else</div>
      <ContextMenu parentRef={parentRef} items={items} />
    </div>
  );
}

const rightClick = (element: Element, clientX = 120, clientY = 80) =>
  fireEvent.contextMenu(element, { clientX, clientY });

async function openMenu(clientX?: number, clientY?: number) {
  rightClick(screen.getByTestId("target"), clientX, clientY);
  return screen.findByRole("menu");
}

const row = (name: string | RegExp) => screen.getByRole("menuitem", { name });

afterEach(() => {
  surface.props.length = 0;
  vi.restoreAllMocks();
});

describe("ContextMenu opening and anchoring", () => {
  it("stays closed until its parent is right-clicked", () => {
    render(<Harness items={[{ key: "copy", title: "Copy link", action: vi.fn() }]} />);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("opens on a right click anywhere inside parentRef and swallows the native menu", async () => {
    const onOuterContextMenu = vi.fn();
    render(
      <Harness items={[{ key: "copy", title: "Copy link", action: vi.fn() }]} onOuterContextMenu={onOuterContextMenu} />
    );
    // fireEvent returns false once a listener called preventDefault()
    expect(rightClick(screen.getByTestId("target-child"))).toBe(false);
    expect(await screen.findByRole("menu")).toBeDefined();
    expect(row("Copy link")).toBeDefined();
    // the event stops at parentRef, so an enclosing right-click handler never sees it
    expect(onOuterContextMenu).not.toHaveBeenCalled();
  });

  it("ignores right clicks outside parentRef", () => {
    render(<Harness items={[{ key: "copy", title: "Copy link", action: vi.fn() }]} />);
    expect(rightClick(screen.getByTestId("outside"))).toBe(true);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("pins the surface to the cursor of the latest right click", async () => {
    render(<Harness items={[{ key: "copy", title: "Copy link", action: vi.fn() }]} />);
    await openMenu(120, 80);
    const latest = surface.props.at(-1);
    expect(latest).toMatchObject({ side: "bottom", align: "start", sideOffset: 0 });
    const anchor = latest?.anchor as TVirtualAnchor;
    expect(anchor.getBoundingClientRect()).toMatchObject({ x: 120, y: 80, width: 0, height: 0 });

    rightClick(screen.getByTestId("target"), 300, 45);
    const next = surface.props.at(-1)?.anchor as TVirtualAnchor;
    expect(next.getBoundingClientRect()).toMatchObject({ x: 300, y: 45, width: 0, height: 0 });
    // a new anchor object, so Base UI re-positions the already open popup
    expect(next).not.toBe(anchor);
  });

  it("reports open state changes to onOpenChange", async () => {
    const onOpenChange = vi.fn();
    const parent = document.createElement("div");
    document.body.append(parent);
    const parentRef = { current: parent };
    render(
      <ContextMenu
        parentRef={parentRef}
        items={[{ key: "copy", title: "Copy link", action: vi.fn() }]}
        onOpenChange={onOpenChange}
      />
    );
    fireEvent.contextMenu(parent, { clientX: 10, clientY: 10 });
    await screen.findByRole("menu");
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    await waitFor(() => expect(onOpenChange).toHaveBeenLastCalledWith(false));
    parent.remove();
  });

  it("opens a pill's own picker on right click instead of the card menu", () => {
    const openPicker = vi.fn();
    const parent = document.createElement("div");
    const pill = document.createElement("button");
    pill.setAttribute("aria-haspopup", "listbox");
    pill.innerHTML = "<span>2 labels</span>";
    pill.addEventListener("click", openPicker);
    const disabledPill = document.createElement("button");
    disabledPill.setAttribute("aria-haspopup", "listbox");
    disabledPill.disabled = true;
    parent.append(pill, disabledPill);
    document.body.append(parent);
    render(
      <ContextMenu parentRef={{ current: parent }} items={[{ key: "copy", title: "Copy link", action: vi.fn() }]} />
    );

    expect(fireEvent.contextMenu(pill.firstElementChild!, { clientX: 5, clientY: 5 })).toBe(false);
    expect(openPicker).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();

    // a disabled pill has no picker to open, so the card menu still shows
    fireEvent.contextMenu(disabledPill, { clientX: 5, clientY: 5 });
    expect(openPicker).toHaveBeenCalledTimes(1);
    parent.remove();
  });

  it("detaches its listener from parentRef on unmount", () => {
    const { unmount } = render(<Harness items={[{ key: "copy", title: "Copy link", action: vi.fn() }]} />);
    const target = screen.getByTestId("target");
    unmount();
    expect(fireEvent.contextMenu(target)).toBe(true);
  });

  it("leaves the native menu alone on mobile", async () => {
    vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)");
    render(<Harness items={[{ key: "copy", title: "Copy link", action: vi.fn() }]} />);
    // usePlatformOS reads the user agent in an effect, so let it settle before right-clicking
    await waitFor(() => expect(rightClick(screen.getByTestId("target"))).toBe(true));
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    render(<Harness items={[{ key: "copy", title: "Copy link", action: vi.fn() }]} />);
    await openMenu();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  });
});

describe("ContextMenu rows", () => {
  it("renders renderable rows in order and drops shouldRender: false", async () => {
    render(
      <Harness
        items={[
          { key: "copy", title: "Copy link", action: vi.fn() },
          { key: "hidden", title: "Hidden", shouldRender: false, action: vi.fn() },
          { key: "archive", title: "Archive", action: vi.fn() },
        ]}
      />
    );
    const menu = await openMenu();
    const rows = Array.from(menu.querySelectorAll('[role="menuitem"]')).map((element) => element.textContent);
    expect(rows).toEqual(["Copy link", "Archive"]);
  });

  it("fires the row's action and closes the menu", async () => {
    const user = userEvent.setup();
    const copy = vi.fn();
    const remove = vi.fn();
    render(
      <Harness
        items={[
          { key: "copy", title: "Copy link", action: copy },
          { key: "delete", title: "Delete", action: remove },
        ]}
      />
    );
    await openMenu();
    await user.click(row("Copy link"));
    expect(copy).toHaveBeenCalledTimes(1);
    expect(remove).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  });

  it("keeps a row click from reaching a wrapping link's click handler", async () => {
    // The surface is portalled, but React events bubble through the consumer's tree, so a card
    // `Link` around the menu would otherwise navigate on every choice.
    const user = userEvent.setup();
    const copy = vi.fn();
    const onOuterClick = vi.fn();
    render(<Harness items={[{ key: "copy", title: "Copy link", action: copy }]} onOuterClick={onOuterClick} />);
    await openMenu();
    await user.click(row("Copy link"));
    expect(copy).toHaveBeenCalledTimes(1);
    expect(onOuterClick).not.toHaveBeenCalled();
  });

  it("stays open after a closeOnClick: false row is pressed", async () => {
    const user = userEvent.setup();
    const toggle = vi.fn();
    render(<Harness items={[{ key: "toggle", title: "Show sub-work items", closeOnClick: false, action: toggle }]} />);
    await openMenu();
    await user.click(row("Show sub-work items"));
    expect(toggle).toHaveBeenCalledTimes(1);
    // a closing surface drops `data-open` before it unmounts, so this catches a close in flight too
    expect(screen.getByRole("menu").hasAttribute("data-open")).toBe(true);
  });

  it("marks disabled rows and never fires their action", async () => {
    const user = userEvent.setup();
    const archive = vi.fn();
    render(<Harness items={[{ key: "archive", title: "Archive", disabled: true, action: archive }]} />);
    await openMenu();
    const archiveRow = row(/Archive/);
    expect(archiveRow.getAttribute("aria-disabled")).toBe("true");
    await user.click(archiveRow);
    expect(archive).not.toHaveBeenCalled();
  });

  it("keeps a disabled row to one line and moves its reason into a tooltip", async () => {
    render(
      <Harness
        items={[
          {
            key: "archive",
            title: "Archive",
            description: "Only completed cycles can be archived",
            disabled: true,
            action: vi.fn(),
          },
        ]}
      />
    );
    await openMenu();
    const archiveRow = row(/Archive/);
    expect(archiveRow.textContent).toBe("Archive");
    expect(screen.queryByText("Only completed cycles can be archived")).toBeNull();
  });

  it("renders the description of an enabled row as a second line under the label", async () => {
    render(
      <Harness
        items={[
          {
            key: "archive",
            title: "Archive",
            description: "Only completed cycles can be archived",
            action: vi.fn(),
          },
        ]}
      />
    );
    await openMenu();
    const archiveRow = row(/Archive/);
    const label = screen.getByText("Archive");
    const description = screen.getByText("Only completed cycles can be archived");
    expect(archiveRow.contains(description)).toBe(true);
    // label over description in one text column nested in the row — not a label plus an inline-end
    // slot sitting directly in the row
    const textColumn = description.parentElement;
    expect(textColumn).not.toBe(archiveRow);
    expect(textColumn?.parentElement).toBe(archiveRow);
    expect(label.parentElement).toBe(textColumn);
    expect(label.nextElementSibling).toBe(description);
  });

  it("paints danger rows, from variant or a legacy text-danger className, and keeps accent neutral", async () => {
    render(
      <Harness
        items={[
          { key: "copy", title: "Copy link", action: vi.fn() },
          { key: "delete", title: "Delete", variant: "danger", action: vi.fn() },
          { key: "legacy", title: "Remove", className: "text-danger-primary", action: vi.fn() },
          { key: "accent", title: "Favorite", variant: "accent", action: vi.fn() },
        ]}
      />
    );
    await openMenu();
    const isDanger = (name: string) => row(name).classList.contains("text-danger-primary");
    expect(isDanger("Delete")).toBe(true);
    expect(isDanger("Remove")).toBe(true);
    expect(isDanger("Copy link")).toBe(false);
    expect(isDanger("Favorite")).toBe(false);
    // Propel's context row has no accent look, so accent renders as the neutral row
    expect(row("Favorite").className).toBe(row("Copy link").className);
  });

  it("renders the icon, or customContent in its place, in the leading slot", async () => {
    render(
      <Harness
        items={[
          { key: "copy", title: "Copy link", icon: Glyph, action: vi.fn() },
          {
            key: "custom",
            title: "Custom",
            icon: Glyph,
            customContent: <span data-testid="custom-content">★</span>,
            action: vi.fn(),
          },
        ]}
      />
    );
    await openMenu();
    const glyphs = screen.getAllByTestId("row-glyph");
    expect(glyphs).toHaveLength(1);
    expect(row("Copy link").contains(glyphs[0])).toBe(true);
    const custom = screen.getByTestId("custom-content");
    expect(row(/Custom/).firstElementChild).toBe(custom);
  });
});

describe("ContextMenu nested rows", () => {
  const nested = (onBacklog: () => void): TContextMenuItem[] => [
    { key: "copy", title: "Copy link", action: vi.fn() },
    {
      key: "move",
      title: "Move to",
      action: vi.fn(),
      nestedMenuItems: [
        { key: "backlog", title: "Backlog", action: onBacklog },
        { key: "done", title: "Done", action: vi.fn() },
        { key: "hidden", title: "Hidden", shouldRender: false, action: vi.fn() },
      ],
    },
  ];

  it("turns a row with renderable nestedMenuItems into a submenu trigger", async () => {
    // While the pointer travels into a hover-opened submenu, Floating UI's safe polygon sets
    // `pointer-events: none` on <body> and `auto` on the surface; jsdom's computed style does not
    // resolve that override, so user-event's pointer-events guard would reject the nested row.
    // `delay: null` runs each pointer sequence without yielding to timers: the trail from the
    // trigger to a nested row otherwise leaves room for the submenu's hover-out close to fire under
    // a loaded test run, and the click then lands on a detached row.
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never, delay: null });
    const onBacklog = vi.fn();
    render(<Harness items={nested(onBacklog)} />);
    await openMenu();
    const trigger = row("Move to");
    expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
    expect(row("Copy link").hasAttribute("aria-haspopup")).toBe(false);

    await user.click(trigger);
    await waitFor(() => expect(screen.getAllByRole("menu")).toHaveLength(2));
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(row("Backlog")).toBeDefined();
    expect(row("Done")).toBeDefined();
    expect(screen.queryByRole("menuitem", { name: "Hidden" })).toBeNull();

    await user.click(row("Backlog"));
    expect(onBacklog).toHaveBeenCalledTimes(1);
  });

  it("keeps submenu clicks from reaching a wrapping link's click handler", async () => {
    // See the pointer-events and delay note on the submenu trigger test above.
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never, delay: null });
    const onBacklog = vi.fn();
    const onOuterClick = vi.fn();
    render(<Harness items={nested(onBacklog)} onOuterClick={onOuterClick} />);
    await openMenu();
    await user.click(row("Move to"));
    await waitFor(() => expect(screen.getAllByRole("menu")).toHaveLength(2));
    await user.click(row("Backlog"));
    expect(onBacklog).toHaveBeenCalledTimes(1);
    expect(onOuterClick).not.toHaveBeenCalled();
  });

  it("puts a focused filter field at the top of a searchable submenu", async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never, delay: null });
    const items = nested(vi.fn());
    items[1] = { ...items[1], searchable: true, searchPlaceholder: "Change status…" };
    render(<Harness items={items} />);
    await openMenu();
    await user.click(row("Move to"));
    const search = await screen.findByPlaceholderText("Change status…");
    await waitFor(() => expect(document.activeElement).toBe(search));

    await user.keyboard("don");
    expect(row("Done")).toBeDefined();
    expect(screen.queryByRole("menuitem", { name: "Backlog" })).toBeNull();
    // typing stays in the field instead of driving the menu's typeahead or closing it
    expect(screen.getAllByRole("menu")).toHaveLength(2);
  });

  it("renders checked rows as multi-select checkboxes that toggle without closing", async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never, delay: null });
    const toggle = vi.fn();
    render(
      <Harness
        items={[
          { key: "ann", title: "Ann", checked: true, action: toggle },
          { key: "bob", title: "Bob", checked: false, action: toggle },
        ]}
      />
    );
    await openMenu();
    const [ann, bob] = screen.getAllByRole("menuitemcheckbox");
    expect(ann.getAttribute("aria-checked")).toBe("true");
    expect(bob.getAttribute("aria-checked")).toBe("false");
    await user.click(bob);
    expect(toggle).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("menu")).toBeDefined();
  });

  it("renders a plain row when every nested row is hidden", async () => {
    const user = userEvent.setup();
    const move = vi.fn();
    render(
      <Harness
        items={[
          {
            key: "move",
            title: "Move to",
            action: move,
            nestedMenuItems: [{ key: "hidden", title: "Hidden", shouldRender: false, action: vi.fn() }],
          },
        ]}
      />
    );
    await openMenu();
    const plain = row("Move to");
    expect(plain.hasAttribute("aria-haspopup")).toBe(false);
    await user.click(plain);
    expect(move).toHaveBeenCalledTimes(1);
  });

  it("keeps a disabled submenu trigger shut", async () => {
    const user = userEvent.setup();
    const items = nested(vi.fn());
    items[1] = { ...items[1], disabled: true, description: "No other states" };
    render(<Harness items={items} />);
    await openMenu();
    const trigger = row(/Move to/);
    expect(trigger.getAttribute("aria-disabled")).toBe("true");
    // a disabled trigger stays compact; its reason lives in a tooltip
    expect(trigger.textContent).not.toContain("No other states");
    await user.click(trigger);
    expect(screen.getAllByRole("menu")).toHaveLength(1);
    expect(screen.queryByRole("menuitem", { name: "Backlog" })).toBeNull();
  });
});

describe("ContextMenu repeated right clicks", () => {
  it("re-positions the open menu when the same target is right-clicked again", async () => {
    render(<Harness items={[{ key: "copy", title: "Copy link", action: vi.fn() }]} />);
    const menu = await openMenu(120, 80);
    const target = screen.getByTestId("target-child");
    // with the menu open, the click lands on the backdrop/menu and is handed back to the card
    document.elementsFromPoint = vi.fn(() => [menu, target]);
    fireEvent.contextMenu(menu, { clientX: 260, clientY: 140 });
    await waitFor(() =>
      expect((surface.props.at(-1)!.anchor as TVirtualAnchor).getBoundingClientRect()).toMatchObject({
        x: 260,
        y: 140,
      })
    );
    expect(await screen.findByRole("menu")).toBeTruthy();
  });

  const items: TContextMenuItem[] = [{ key: "copy", title: "Copy link", action: vi.fn() }];

  it("never lets the browser menu show when right-clicking the open menu, and hands the click on", async () => {
    render(<Harness items={items} />);
    const menu = await openMenu();
    const under = screen.getByTestId("target-child");
    document.elementsFromPoint = vi.fn(() => [menu, under]);
    const reopened = vi.fn();
    under.addEventListener("contextmenu", reopened);

    expect(fireEvent.contextMenu(menu, { clientX: 200, clientY: 90 })).toBe(false);
    await waitFor(() => expect(reopened).toHaveBeenCalledTimes(1));
    expect(reopened.mock.calls[0][0]).toMatchObject({ clientX: 200, clientY: 90 });
  });
});
