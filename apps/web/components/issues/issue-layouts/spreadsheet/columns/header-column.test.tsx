import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { setLanguage } from "@plane/i18n";
import { SPREADSHEET_PROPERTY_DETAILS } from "@plane/constants";
import type { IIssueDisplayProperties, TIssueOrderByOptions } from "@plane/types";
import { HeaderColumn } from "./header-column";
beforeEach(async () => {
  Element.prototype.getAnimations ??= () => [];
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  await setLanguage("zh-CN");
});
it.each(Object.keys(SPREADSHEET_PROPERTY_DETAILS) as (keyof IIssueDisplayProperties)[])(
  "renders the %s property glyph without leaking mapping keys into SVG",
  (property) => {
    render(
      <HeaderColumn property={property} displayFilters={{}} handleDisplayFilterUpdate={vi.fn()} onClose={vi.fn()} />
    );
    const button = screen.getByRole("button");
    expect(button.querySelectorAll("svg")).toHaveLength(2);
    expect(button.querySelector("svg[iconKey]")).toBeNull();
  }
);
it("uses the real ordering from external controls and applies or clears column sorting", async () => {
  const update = vi.fn();
  const draw = (order_by: TIssueOrderByOptions) => (
    <HeaderColumn property="state" displayFilters={{ order_by }} handleDisplayFilterUpdate={update} onClose={vi.fn()} />
  );
  const { rerender } = render(draw("state__name"));
  fireEvent.click(screen.getByRole("button", { name: "状态" }));
  expect((await screen.findByRole("menuitemradio", { name: "A → Z" })).getAttribute("aria-checked")).toBe("true");
  rerender(draw("-state__name"));
  expect(screen.getByRole("menuitemradio", { name: "Z → A" }).getAttribute("aria-checked")).toBe("true");
  fireEvent.click(screen.getByRole("menuitemradio", { name: "A → Z" }));
  expect(update).toHaveBeenCalledWith({ order_by: "state__name" });
  fireEvent.click(screen.getByRole("button", { name: "状态" }));
  fireEvent.click(await screen.findByRole("menuitem", { name: "清除排序" }));
  expect(update).toHaveBeenLastCalledWith({ order_by: "-created_at" });
});
