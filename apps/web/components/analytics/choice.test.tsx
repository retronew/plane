import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi, beforeEach, afterEach } from "vitest";
import { setLanguage } from "@plane/i18n";
import { AnalyticsChoice } from "./choice";
beforeEach(() =>
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
);
afterEach(() => vi.unstubAllGlobals());
it("clears a selected breakdown without adding an empty option or opening the menu", async () => {
  await setLanguage("zh-CN");
  function Example() {
    const [value, setValue] = useState("users");
    return (
      <AnalyticsChoice
        label="细分维度"
        value={value}
        options={[{ id: "users", label: "负责人" }]}
        placeholder="添加细分"
        onChange={setValue}
        onClear={() => setValue("")}
      />
    );
  }
  render(<Example />);
  fireEvent.click(screen.getByRole("button", { name: "清除" }));
  expect(screen.queryByRole("button", { name: "清除" })).toBeNull();
  expect(screen.queryByRole("listbox")).toBeNull();
  expect(screen.getByText("添加细分")).toBeDefined();
});
