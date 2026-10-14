import { describe, expect, it } from "vitest";
import { getComposerTravel } from "./composer-motion";

describe("composer travel", () => {
  it("aligns the composer center with the trigger without depending on its width", () => {
    const from = { x: 300, y: 80, width: 750, height: 350 } as DOMRect;
    const target = { x: 70, y: 90, width: 220, height: 32 } as DOMRect;
    expect(getComposerTravel(from, target)).toBe("-495px -149px");
  });
});
