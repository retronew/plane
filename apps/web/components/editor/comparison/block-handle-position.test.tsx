import { afterEach, expect, it, vi } from "vitest";
import { observeBlockHandlePosition } from "./block-handle-position";

const rect = (left: number, top: number, width = 200, height = 100) =>
  ({ left, top, width, height, right: left + width, bottom: top + height }) as DOMRect;

function fixture(markup: string) {
  const parent = document.createElement("div");
  parent.innerHTML = `<div><div class="comparison-drag-handle"></div><div class="comparison-drop-gap-before"></div>${markup}<div class="comparison-drop-gap-after"></div></div>`;
  document.body.append(parent);
  const node = parent.firstElementChild as HTMLElement;
  const handle = node.firstElementChild as HTMLElement;
  vi.spyOn(node, "getBoundingClientRect").mockReturnValue(rect(100, 50, 600, 300));
  return { node, handle };
}

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("follows centered/right-aligned images and image resizing without changing block layout", async () => {
  let onResize = () => {};
  const disconnect = vi.fn();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        onResize = callback;
      }
      observe = vi.fn();
      disconnect = disconnect;
    }
  );
  const { node, handle } = fixture('<div><div><img alt="example"></div></div>');
  const image = node.querySelector("img")!;
  const bounds = vi.spyOn(image, "getBoundingClientRect").mockReturnValue(rect(300, 70));
  const cleanup = observeBlockHandlePosition(node, handle);
  expect(handle.style.left).toBe("180px");
  expect(handle.style.top).toBe("26px");
  bounds.mockReturnValue(rect(500, 70));
  image.parentElement!.className = "ml-auto";
  await Promise.resolve();
  expect(handle.style.left).toBe("380px");
  bounds.mockReturnValue(rect(400, 70, 300));
  onResize();
  expect(handle.style.left).toBe("280px");
  expect(node.getAttribute("style")).toBeNull();
  const calls = disconnect.mock.calls.length;
  cleanup?.();
  expect(disconnect).toHaveBeenCalledTimes(calls + 1);
  bounds.mockReturnValue(rect(200, 70));
  image.className = "changed-after-cleanup";
  image.dispatchEvent(new Event("load"));
  window.dispatchEvent(new Event("resize"));
  await Promise.resolve();
  expect(handle.style.left).toBe("280px");
});

it.each(["table", "pre"])("anchors to the actual %s instead of its outer wrapper", (tag) => {
  const { node, handle } = fixture(`<div><${tag}></${tag}></div>`);
  vi.spyOn(node.querySelector(tag)!, "getBoundingClientRect").mockReturnValue(rect(150, 90));
  const cleanup = observeBlockHandlePosition(node, handle);
  expect(handle.style.left).toBe("30px");
  expect(handle.style.top).toBe("46px");
  cleanup?.();
});

it("uses the first rendered text line, including alignment and heading padding", () => {
  const { node, handle } = fixture('<h2 style="padding-top: 24px"><span data-slate-string>Heading</span></h2>');
  vi.spyOn(node.querySelector("span")!, "getClientRects").mockReturnValue([
    rect(320, 90, 180, 24),
  ] as unknown as DOMRectList);
  const cleanup = observeBlockHandlePosition(node, handle);
  expect(handle.style.left).toBe("200px");
  expect(handle.style.top).toBe("44px");
  cleanup?.();
});

it("retargets when media is replaced and falls back for empty blocks", async () => {
  const { node, handle } = fixture('<p style="padding-top: 10px"></p>');
  const content = node.querySelector("p")!;
  vi.spyOn(content, "getBoundingClientRect").mockReturnValue(rect(120, 60));
  const cleanup = observeBlockHandlePosition(node, handle);
  expect(handle.style.left).toBe("0px");
  expect(handle.style.top).toBe("26px");
  const image = document.createElement("img");
  vi.spyOn(image, "getBoundingClientRect").mockReturnValue(rect(400, 70));
  content.append(image);
  await Promise.resolve();
  expect(handle.style.left).toBe("280px");
  expect(handle.style.top).toBe("26px");
  cleanup?.();
});
