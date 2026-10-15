import { StrictMode } from "react";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TabsList } from "@makeplane/propel/components/tabs";
import { AnimatedUnderlineTabs } from "./animated-underline-tabs";
import { UnderlineTabLink } from "./underline-tab-link";

vi.hoisted(() => {
  Element.prototype.getAnimations ??= () => [];
});

const animate = vi.fn();
const animateDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, "animate");
let reduceMotion = false;
const disconnect = vi.fn();
const cancel = vi.fn();
let resizeHandlers: (() => void)[] = [];
beforeEach(() => {
  reduceMotion = false;
  animate.mockReset().mockReturnValue({ cancel });
  cancel.mockClear();
  disconnect.mockClear();
  resizeHandlers = [];
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resizeHandlers.push(callback);
      }
      observe() {}
      unobserve() {}
      disconnect = disconnect;
    }
  );
  Object.defineProperty(Element.prototype, "animate", { configurable: true, value: animate });
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: reduceMotion, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  );
  const original = HTMLElement.prototype.getBoundingClientRect;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const tab = this.closest<HTMLElement>('[role="tab"]');
    if (this.matches('[aria-hidden="true"]') && tab)
      return new DOMRect(tab.dataset.motionValue === "first" ? 10 : 80, 36, 50, 3);
    return original.call(this);
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (animateDescriptor) Object.defineProperty(Element.prototype, "animate", animateDescriptor);
  else Reflect.deleteProperty(Element.prototype, "animate");
});
function Fixture({ value, scope }: { value: string; scope: string }) {
  return (
    <StrictMode>
      <MemoryRouter>
        <AnimatedUnderlineTabs value={value} motionKey={scope}>
          <TabsList>
            <UnderlineTabLink value="first" label="First" to="/first" />
            <UnderlineTabLink value="second" label="Second" to="/second" />
          </TabsList>
        </AnimatedUnderlineTabs>
      </MemoryRouter>
    </StrictMode>
  );
}
it("continues the indicator from the previous route even with Strict Mode effect replay", async () => {
  const first = render(<Fixture scope="route-transition" value="first" />);
  first.unmount();
  render(<Fixture scope="route-transition" value="second" />);
  await waitFor(() => expect(animate).toHaveBeenCalledOnce());
  expect(animate.mock.calls[0][0]).toEqual([
    { left: "10px", top: "36px", width: "50px" },
    { left: "80px", top: "36px", width: "50px" },
  ]);
});
it("does not animate a first visit to a different scope", () => {
  const first = render(<Fixture scope="project-a" value="first" />);
  first.unmount();
  render(<Fixture scope="project-b" value="second" />);
  expect(animate).not.toHaveBeenCalled();
});
it("respects reduced motion when switching route headers", () => {
  const first = render(<Fixture scope="reduced-motion" value="first" />);
  first.unmount();
  reduceMotion = true;
  render(<Fixture scope="reduced-motion" value="second" />);
  expect(animate).not.toHaveBeenCalled();
});
it("pins the measured destination so native indicator updates cannot trigger a second slide", async () => {
  const first = render(<Fixture scope="single-motion" value="first" />);
  first.unmount();
  const { container } = render(<Fixture scope="single-motion" value="second" />);
  await waitFor(() => expect(animate).toHaveBeenCalledOnce());
  const indicator = container.querySelector<HTMLElement>('[role="tablist"] > [role="presentation"]')!;
  expect(indicator.style.transition).toBe("none");
  expect(indicator.style.left).toBe("80px");
  expect(indicator.style.top).toBe("36px");
  expect(indicator.style.width).toBe("50px");
  indicator.style.setProperty("--active-tab-left", "10px");
  resizeHandlers.forEach((callback) => callback());
  expect(indicator.style.left).toBe("80px");
  expect(animate).toHaveBeenCalledOnce();
});
