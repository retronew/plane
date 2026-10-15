import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { setLanguage } from "@plane/i18n";
import type { IIssueDisplayProperties } from "@plane/types";
import { SpreadsheetPropertiesMenu } from "./properties-menu";
const update = vi.fn();
function Fixture() {
  const [properties, setProperties] = useState<IIssueDisplayProperties>({ state: true });
  return (
    <SpreadsheetPropertiesMenu
      displayProperties={properties}
      properties={["state", "created_by"]}
      onChange={(next) => {
        update(next);
        setProperties((prev) => ({ ...prev, ...next }));
      }}
    />
  );
}
beforeEach(async () => {
  await setLanguage("zh-CN");
  update.mockClear();
  Element.prototype.getAnimations ??= () => [];
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});
it("updates individual properties without closing, retains other columns and respects the allowed properties", async () => {
  render(<Fixture />);
  fireEvent.click(screen.getByRole("button", { name: "显示属性" }));
  const creator = await screen.findByRole("menuitemcheckbox", { name: "创建者" });
  fireEvent.click(creator);
  await waitFor(() => expect(update).toHaveBeenLastCalledWith({ created_by: true }));
  expect(creator.getAttribute("aria-checked")).toBe("true");
  expect(screen.getByRole("menuitemcheckbox", { name: "状态" }).getAttribute("aria-checked")).toBe("true");
  expect(screen.queryByRole("menuitemcheckbox", { name: "周期" })).toBeNull();
  fireEvent.click(creator);
  await waitFor(() => expect(update).toHaveBeenLastCalledWith({ created_by: false }));
});
