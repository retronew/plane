export const COMPOSER_RESTORE_DURATION = 260;
export const COMPOSER_MOTION_EASING =
  "linear(0, 0.08, 0.24, 0.41, 0.56, 0.68, 0.77, 0.84, 0.89, 0.925, 0.95, 0.966, 0.977, 0.985, 0.99, 0.993, 0.996, 0.998, 0.999, 1)";

export function getComposerTravel(from: DOMRect, to: DOMRect) {
  return `${to.x + to.width / 2 - from.x - from.width / 2}px ${to.y + to.height / 2 - from.y - from.height / 2}px`;
}

export function prepareComposerMotion(popup: HTMLElement, kind: "new" | "draft" = "new", targetSelector?: string) {
  const selector =
    targetSelector ?? (kind === "draft" ? "[data-draft-work-item-trigger]" : "[data-new-work-item-trigger]");
  const target = Array.from(document.querySelectorAll<HTMLElement>(selector)).find((element) => {
    const rect = element.getBoundingClientRect();
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      rect.right > 0 &&
      rect.left < window.innerWidth &&
      rect.bottom > 0 &&
      rect.top < window.innerHeight
    );
  });
  if (!target || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  // Layout dimensions avoid measuring the entry animation's temporary scale.
  const rect = popup.getBoundingClientRect();
  const from = new DOMRect(
    rect.x + (rect.width - popup.offsetWidth) / 2,
    rect.y + (rect.height - popup.offsetHeight) / 2,
    popup.offsetWidth,
    popup.offsetHeight
  );
  const travel = getComposerTravel(from, target.getBoundingClientRect());
  popup.style.setProperty("--composer-travel", travel);
  return travel;
}
