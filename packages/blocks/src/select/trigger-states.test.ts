import { expect, it } from "vitest";
import { getSelectClassName } from "./utils";
it("keeps active select chrome under hover", () => {
  const active = getSelectClassName("select", "md", true);
  expect(active).toContain("hover:border-accent-strong");
  expect(active).toContain("hover:bg-layer-2");
  expect(active).toContain("data-invalid:hover:border-danger-strong");
});
it("preserves keyboard focus and ghost open backgrounds on hover", () => {
  expect(getSelectClassName("select", "md", false)).toContain("focus-visible:hover:border-accent-strong");
  expect(getSelectClassName("select-ghost", "md", true)).toContain("hover:bg-layer-transparent-active");
});
