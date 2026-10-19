import { render } from "@testing-library/react";
import { expect, it } from "vitest";
import { ArchivedCycleVerticalStackIllustration } from "./archived-cycle";
import { ArchivedWorkItemVerticalStackIllustration } from "./archived-work-item";
import { CustomerVerticalStackIllustration } from "./customer";
import { ModuleVerticalStackIllustration } from "./module";
import { ServerErrorVerticalStackIllustration } from "./server-error";
import { TeamspaceVerticalStackIllustration } from "./teamspace";
import { ViewVerticalStackIllustration } from "./view";

// Path counts come from the pre-split files: the layer components only move existing nodes.
const illustrations = [
  ["archived cycle", ArchivedCycleVerticalStackIllustration, 51],
  ["archived work item", ArchivedWorkItemVerticalStackIllustration, 46],
  ["customer", CustomerVerticalStackIllustration, 48],
  ["module", ModuleVerticalStackIllustration, 58],
  ["server error", ServerErrorVerticalStackIllustration, 59],
  ["teamspace", TeamspaceVerticalStackIllustration, 47],
  ["view", ViewVerticalStackIllustration, 49],
] as const;

it.each(illustrations)("keeps every path and layer of the %s illustration", (_name, Illustration, pathCount) => {
  const { container } = render(<Illustration className="test-class" />);

  const svg = container.querySelector("svg");
  expect(svg).toBeTruthy();
  expect(svg?.getAttribute("class")).toBe("test-class");
  expect(svg?.querySelectorAll("path")).toHaveLength(pathCount);
  // The two opacity groups that sit behind the foreground artwork.
  expect(svg?.querySelectorAll("g")).toHaveLength(2);
});
