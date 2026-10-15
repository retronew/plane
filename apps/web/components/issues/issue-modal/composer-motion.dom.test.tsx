import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { prepareComposerMotion } from "./composer-motion";

function element(attribute: string, rect: DOMRect) {
  const node = document.createElement("div");
  node.setAttribute(attribute, "");
  node.getBoundingClientRect = () => rect;
  document.body.append(node);
  return node;
}
beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
});
afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});
function popup() {
  const node = element("data-issue-composer", new DOMRect(200, 100, 600, 300));
  Object.defineProperties(node, { offsetWidth: { value: 600 }, offsetHeight: { value: 300 } });
  return node;
}
it("uses the draft trigger for draft minimize and restore geometry", () => {
  element("data-new-work-item-trigger", new DOMRect(50, 100, 200, 30));
  element("data-draft-work-item-trigger", new DOMRect(800, 50, 100, 30));
  const modal = popup();
  expect(prepareComposerMotion(modal, "draft")).toBe("350px -185px");
  expect(modal.style.getPropertyValue("--composer-travel")).toBe("350px -185px");
  expect(prepareComposerMotion(modal)).toBe("-350px -135px");
});
it("does not send a draft to the regular create button when its trigger is absent", () => {
  element("data-new-work-item-trigger", new DOMRect(50, 100, 200, 30));
  expect(prepareComposerMotion(popup(), "draft")).toBeUndefined();
});
it("ignores offscreen duplicates and respects reduced motion", () => {
  element("data-draft-work-item-trigger", new DOMRect(-200, 20, 100, 30));
  element("data-draft-work-item-trigger", new DOMRect(800, 50, 100, 30));
  expect(prepareComposerMotion(popup(), "draft")).toBe("350px -185px");
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  expect(prepareComposerMotion(popup(), "draft")).toBeUndefined();
});
