import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { ModuleIdentity } from "./module-identity";

afterEach(cleanup);
it("keeps a module's colour across renames while updating its visible initials", () => {
  const { container, rerender } = render(<ModuleIdentity id="module-a" name="接口改造" />);
  const colour = container.firstElementChild?.getAttribute("style");
  expect(container.textContent).toBe("接口");
  rerender(<ModuleIdentity id="module-a" name="API migration" />);
  expect(container.firstElementChild?.getAttribute("style")).toBe(colour);
  expect(container.textContent).toBe("AP");
});
it("uses module identity rather than name to distinguish equal names", () => {
  const { container } = render(
    <>
      <ModuleIdentity id="module-a" name="Release" />
      <ModuleIdentity id="module-b" name="Release" />
    </>
  );
  const [first, second] = container.children;
  expect(first?.getAttribute("style")).not.toBe(second?.getAttribute("style"));
});
it("preserves unicode characters and has a fallback for an unloaded name", () => {
  const { container, rerender } = render(<ModuleIdentity id="a" name="🧪验收" />);
  expect(container.textContent).toBe("🧪验");
  rerender(<ModuleIdentity id="a" name="  " />);
  expect(container.textContent).toBe("M");
  expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
});
