import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { expect, it, vi } from "vitest";
import { ResizableSidebar } from "./resizable-sidebar";
vi.mock("@plane/hooks", () => ({ usePlatformOS: () => ({ isMobile: false }) }));
vi.mock("@plane/i18n", () => ({ translate: (key: string) => key }));
const toggle = vi.fn();
function Fixture() {
  const [width, setWidth] = useState(250);
  return (
    <ResizableSidebar width={width} setWidth={setWidth} toggleCollapsed={toggle} togglePeek={() => {}}>
      <span>Navigation</span>
    </ResizableSidebar>
  );
}
it("provides native resize controls with keyboard limits and preserves double-click collapse", () => {
  toggle.mockClear();
  render(<Fixture />);
  const slider = screen.getAllByRole("slider")[0] as HTMLInputElement;
  expect(screen.getByRole("complementary", { name: "web.main_sidebar" }).tagName).toBe("ASIDE");
  fireEvent.keyDown(slider, { key: "ArrowRight" });
  expect(slider.value).toBe("260");
  fireEvent.keyDown(slider, { key: "End" });
  expect(slider.value).toBe("350");
  fireEvent.keyDown(slider, { key: "ArrowRight" });
  expect(slider.value).toBe("350");
  fireEvent.keyDown(slider, { key: "Home" });
  expect(slider.value).toBe("236");
  fireEvent.doubleClick(slider);
  expect(toggle).toHaveBeenCalledOnce();
});
it("resizes with the pointer and stops changing width after release", () => {
  render(<Fixture />);
  const slider = screen.getAllByRole("slider")[0] as HTMLInputElement;
  fireEvent.mouseDown(slider, { clientX: 250 });
  fireEvent.mouseMove(document, { clientX: 300 });
  expect(slider.value).toBe("300");
  fireEvent.mouseUp(document);
  fireEvent.mouseMove(document, { clientX: 340 });
  expect(slider.value).toBe("300");
});
