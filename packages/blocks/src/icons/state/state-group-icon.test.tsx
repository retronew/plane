import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { StateGroup } from "./helper";
import { STATE_GROUP_COLORS } from "./helper";
import { StateGroupIcon } from "./state-group-icon";

const groups = Object.keys(STATE_GROUP_COLORS) as StateGroup[];

function getPaints(container: HTMLElement) {
  return Array.from(container.querySelectorAll("[stroke], [fill]"))
    .flatMap((element) => [element.getAttribute("stroke"), element.getAttribute("fill")])
    .filter((paint): paint is string => paint !== null && paint !== "none");
}

describe("StateGroupIcon", () => {
  it.each([
    "queued",
    "paused",
    "blocked",
    "review",
    "planned",
    "ready",
    "active",
    "feedback",
    "testing",
    "verifying",
    "approval",
    "rework",
    "skipped",
    "archived",
  ])("renders the %s workflow preset with its chosen color", (icon) => {
    const { container } = render(<StateGroupIcon stateGroup="started" icon={icon} color="#663399" />);
    expect(container.querySelector("svg")?.getAttribute("stroke")).toBe("#663399");
    expect(
      container.querySelector("svg")?.classList.contains(`lucide-${icon}`) ||
        container.querySelector("svg")?.classList.contains("lucide")
    ).toBe(true);
  });
  it("uses a fixed progress preset regardless of group order", () => {
    const { container, rerender } = render(<StateGroupIcon stateGroup="started" icon="started-25" percentage={0.5} />);
    const markup = container.innerHTML;
    rerender(<StateGroupIcon stateGroup="started" icon="started-25" percentage={1} />);
    expect(container.innerHTML).toBe(markup);
    rerender(<StateGroupIcon stateGroup="started" icon={null} percentage={1} />);
    expect(container.innerHTML).not.toBe(markup);
  });

  it("changes only appearance and keeps the chosen color", () => {
    const { container, rerender } = render(<StateGroupIcon stateGroup="started" icon="completed" color="#8B5CF6" />);
    const markup = container.innerHTML;
    rerender(<StateGroupIcon stateGroup="completed" color="#8B5CF6" />);
    expect(container.innerHTML).toBe(markup);
  });
  it.each(groups)("preserves custom colors for %s", (stateGroup) => {
    const { container } = render(<StateGroupIcon stateGroup={stateGroup} color="#8B5CF6" />);
    expect(getPaints(container).length).toBeGreaterThan(0);
    expect(new Set(getPaints(container))).toEqual(new Set(["#8B5CF6"]));
  });

  it.each(groups)("uses the group color for empty %s colors", (stateGroup) => {
    const { container, rerender } = render(<StateGroupIcon stateGroup={stateGroup} color="" />);
    expect(new Set(getPaints(container))).toEqual(new Set([STATE_GROUP_COLORS[stateGroup]]));
    rerender(<StateGroupIcon stateGroup={stateGroup} color="   " />);
    expect(new Set(getPaints(container))).toEqual(new Set([STATE_GROUP_COLORS[stateGroup]]));
  });

  it.each(["custom", "", "constructor", "toString", undefined, null])(
    "uses the unstarted icon and color for an unsupported group %s",
    (stateGroup) => {
      const { container } = render(<StateGroupIcon stateGroup={stateGroup as StateGroup} />);
      expect(container.querySelector("svg circle")).not.toBeNull();
      expect(new Set(getPaints(container))).toEqual(new Set([STATE_GROUP_COLORS.unstarted]));
    }
  );

  it("preserves custom colors when the group is unknown", () => {
    const { container } = render(<StateGroupIcon stateGroup={"custom" as StateGroup} color="#8B5CF6" />);
    expect(new Set(getPaints(container))).toEqual(new Set(["#8B5CF6"]));
  });
});
