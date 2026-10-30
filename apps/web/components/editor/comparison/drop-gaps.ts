// Collapsed margins sit outside native drop targets. Split the empty space
// between neighbours without changing the document's visual spacing.
export function observeDropGaps(node: HTMLElement) {
  const parent = node.parentElement;
  if (!parent || typeof ResizeObserver === "undefined") return;
  const measure = () => {
    const rect = node.getBoundingClientRect();
    const previous = node.previousElementSibling?.getBoundingClientRect();
    const next = node.nextElementSibling?.getBoundingClientRect();
    node.style.setProperty("--drop-gap-before", `${previous ? Math.max(0, rect.top - previous.bottom) / 2 : 0}px`);
    node.style.setProperty("--drop-gap-after", `${next ? Math.max(0, next.top - rect.bottom) / 2 : 0}px`);
  };
  const resize = new ResizeObserver(measure);
  const observe = () => {
    resize.disconnect();
    resize.observe(parent);
    resize.observe(node);
    if (node.previousElementSibling) resize.observe(node.previousElementSibling);
    if (node.nextElementSibling) resize.observe(node.nextElementSibling);
    measure();
  };
  const mutation = new MutationObserver(observe);
  mutation.observe(parent, { childList: true });
  observe();
  return () => {
    resize.disconnect();
    mutation.disconnect();
  };
}
