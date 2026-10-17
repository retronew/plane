import { useState } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Menu, MenuContent, MenuTrigger } from "@makeplane/propel/components/menu";
import { DATE_AFTER_FILTER_OPTIONS } from "@plane/constants";
import { setLanguage } from "@plane/i18n";
import type { TCycleFilters } from "@plane/types";
import { CycleFiltersSelection } from "./root";

beforeEach(async () => {
  await setLanguage("en");
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  Element.prototype.getAnimations ??= () => [];
});
afterEach(() => vi.unstubAllGlobals());

const EMPTY_FILTERS: TCycleFilters = {};
const noop = () => {};

function FilterMenu({
  initial = EMPTY_FILTERS,
  archived = false,
  onChange = noop,
}: {
  initial?: TCycleFilters;
  archived?: boolean;
  onChange?: (field: keyof TCycleFilters, value: string | string[]) => void;
}) {
  const [filters, setFilters] = useState(initial);
  return (
    <Menu defaultOpen>
      <MenuTrigger render={<button type="button">Filters</button>} />
      <MenuContent>
        <CycleFiltersSelection
          filters={filters}
          isArchived={archived}
          handleFiltersUpdate={(field, value) => {
            onChange(field, value);
            setFilters((previous) => {
              const next = [...(previous[field] ?? [])];
              for (const item of Array.isArray(value) ? value : [value]) {
                const index = next.indexOf(item);
                if (index < 0) next.push(item);
                else next.splice(index, 1);
              }
              return { ...previous, [field]: next };
            });
          }}
        />
      </MenuContent>
    </Menu>
  );
}

it("uses real Propel submenus to toggle multiple statuses without closing the menu", async () => {
  const change = vi.fn();
  render(<FilterMenu onChange={change} />);
  fireEvent.click(await screen.findByRole("menuitem", { name: "Status" }));
  const status = await screen.findByRole("menuitemcheckbox", { name: "In progress" });
  fireEvent.click(status);
  await waitFor(() => expect(status.getAttribute("aria-checked")).toBe("true"));
  fireEvent.click(await screen.findByRole("menuitemcheckbox", { name: "Draft" }));
  expect(change).toHaveBeenLastCalledWith("status", "draft");
  fireEvent.click(status);
  expect(change).toHaveBeenLastCalledWith("status", "current");
  await waitFor(() => expect(status.getAttribute("aria-checked")).toBe("false"));
});

it.each(["start_date", "end_date"] as const)(
  "keeps presets and custom dates independently toggleable for %s",
  async (field) => {
    const change = vi.fn();
    render(<FilterMenu initial={{ [field]: ["2026-10-01;after", "2026-10-31;before"] }} onChange={change} />);
    fireEvent.click(
      await screen.findByRole("menuitem", { name: field === "start_date" ? /^Start date/ : /^End date/ })
    );
    const preset = await screen.findByRole("menuitemcheckbox", { name: DATE_AFTER_FILTER_OPTIONS[0].name });
    fireEvent.click(preset);
    expect(change).toHaveBeenLastCalledWith(field, DATE_AFTER_FILTER_OPTIONS[0].value);
    fireEvent.click(screen.getByRole("menuitem", { name: /^Custom/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Remove" }));
    expect(change).toHaveBeenLastCalledWith(field, ["2026-10-01;after", "2026-10-31;before"]);
    await waitFor(() => expect(screen.getByRole("menuitem", { name: "Custom" })).toBeTruthy());
    expect(preset.getAttribute("aria-checked")).toBe("true");
  }
);

it("edits an existing custom range without toggling off an unchanged boundary or preset", async () => {
  const change = vi.fn();
  const preset = DATE_AFTER_FILTER_OPTIONS[0].value;
  render(<FilterMenu initial={{ start_date: [preset, "2026-10-01;after", "2026-10-31;before"] }} onChange={change} />);
  fireEvent.click(await screen.findByRole("menuitem", { name: /^Start date/ }));
  fireEvent.click(await screen.findByRole("menuitem", { name: /^Custom/ }));
  fireEvent.click(await screen.findByRole("button", { name: "Apply" }));
  expect(change).not.toHaveBeenCalled();
  fireEvent.click(await screen.findByRole("menuitem", { name: /^Custom/ }));
  fireEvent.click(await screen.findByRole("button", { name: "Before:" }));
  const grid = await screen.findByRole("grid");
  const day = within(grid)
    .getAllByRole("button")
    .find((button) => !(button as HTMLButtonElement).disabled);
  fireEvent.click(day!);
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
  expect(change).toHaveBeenCalledOnce();
  const updates = change.mock.calls[0][1] as string[];
  expect(updates).toContain("2026-10-01;after");
  expect(updates).not.toContain(preset);
});

it.each(["before", "after", "range"] as const)(
  "applies custom %s dates inside the real calendar submenu in archive mode",
  async (condition) => {
    const change = vi.fn();
    render(<FilterMenu archived onChange={change} />);
    expect(screen.queryByRole("menuitem", { name: "Status" })).toBeNull();
    fireEvent.click(await screen.findByRole("menuitem", { name: "End date" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Custom" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    const apply = await screen.findByRole("button", { name: "Apply" });
    expect((apply as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(
      screen.getByRole("button", {
        name: condition === "range" ? "Date range" : condition === "before" ? "Before:" : "After:",
      })
    );
    const grid = await screen.findByRole("grid");
    const dates = within(grid)
      .getAllByRole("button")
      .filter((button) => !(button as HTMLButtonElement).disabled);
    fireEvent.click(dates[7]);
    if (condition === "range") fireEvent.click(dates[14]);
    fireEvent.click(apply);
    await waitFor(() =>
      expect(change).toHaveBeenCalledWith(
        "end_date",
        condition === "range"
          ? [expect.stringMatching(/^\d{4}-\d{2}-\d{2};after$/), expect.stringMatching(/^\d{4}-\d{2}-\d{2};before$/)]
          : [expect.stringMatching(new RegExp(`^\\d{4}-\\d{2}-\\d{2};${condition}$`))]
      )
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  }
);
