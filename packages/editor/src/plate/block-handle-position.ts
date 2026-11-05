// Measure the rendered content, not the full-width Slate/DnD wrapper.
// Only the handle is moved; the official drop target and document layout stay intact.
export function observeBlockHandlePosition(node: HTMLElement, handle: HTMLElement) {
  const findContent = () => node.querySelector(":scope > [data-block-content]")?.firstElementChild;
  const initial = findContent();
  if (!(initial instanceof HTMLElement)) return;
  let content: HTMLElement = initial;

  const measure = () => {
    const origin = node.getBoundingClientRect();
    const visual = content.matches("img, table, pre, hr") ? content : content.querySelector("img, table, pre, hr");
    const text = content.querySelector<HTMLElement>("[data-slate-string], [data-slate-zero-width]");
    const textRect = !visual && text?.getClientRects()[0];
    const target = visual ?? content;
    const rect = textRect || target.getBoundingClientRect();
    const style = getComputedStyle(content);
    const checkbox = content.matches('[data-type="taskItem"]')
      ? content.querySelector<HTMLElement>('[role="checkbox"]')
      : null;
    const checkboxRect = checkbox?.getBoundingClientRect();
    // Keep task handles outside the row and centered on its checkbox, including wrapped text.
    const horizontalRect = checkboxRect ?? rect;
    const left = horizontalRect.left - origin.left - node.clientLeft;
    const top = rect.top - origin.top - node.clientTop;
    // A text line's rect already includes heading/paragraph padding and alignment.
    const inset = textRect ? Math.max(0, (rect.height - 16) / 2) : visual ? 6 : (parseFloat(style.paddingTop) || 0) + 6;
    handle.style.left = `${left - 20}px`;
    handle.style.top = `${checkboxRect ? checkboxRect.top - origin.top - node.clientTop + (checkboxRect.height - 16) / 2 : top + inset}px`;
  };

  const resize = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(measure);
  const observe = () => {
    resize?.disconnect();
    resize?.observe(node);
    resize?.observe(content);
    // Resizable media and table containers can resize without changing the row's size.
    content.querySelectorAll("img, table, pre, [data-slate-string], [data-slate-zero-width]").forEach((target) => {
      resize?.observe(target);
    });
    measure();
  };
  const mutation = new MutationObserver((records) => {
    // Ignore our handle writes and gap measurements to avoid observer loops.
    if (!records.some((record) => record.type === "childList" || content.contains(record.target))) return;
    const next = findContent();
    if (!(next instanceof HTMLElement)) return;
    content = next;
    observe();
  });
  mutation.observe(node, { attributes: true, childList: true, characterData: true, subtree: true });
  // First-child styling can change when a neighbouring block is inserted or removed.
  const siblings = new MutationObserver(measure);
  if (node.parentElement) siblings.observe(node.parentElement, { childList: true });
  node.addEventListener("load", measure, true);
  node.addEventListener("scroll", measure, true);
  window.addEventListener("resize", measure);
  observe();
  return () => {
    resize?.disconnect();
    mutation.disconnect();
    siblings.disconnect();
    node.removeEventListener("load", measure, true);
    node.removeEventListener("scroll", measure, true);
    window.removeEventListener("resize", measure);
  };
}
