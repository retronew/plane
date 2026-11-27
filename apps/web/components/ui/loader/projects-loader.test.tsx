import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectsLoader } from "./projects-loader";

vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe("ProjectsLoader", () => {
  it("renders gallery skeleton immediately without a blank delay and with 4 cards", () => {
    const { container } = render(<ProjectsLoader layout="gallery" />);
    const loader = container.querySelector('[data-project-loader="gallery"]');
    expect(loader).toBeTruthy();
    const cards = container.querySelectorAll('[data-project-loader="gallery"] .grid > div');
    expect(cards.length).toBe(4);
    expect(container.innerHTML).not.toContain("#262626");
  });

  it("renders board, list, and timeline skeletons immediately", () => {
    for (const layout of ["board", "list", "timeline"] as const) {
      const { container } = render(<ProjectsLoader layout={layout} />);
      expect(container.querySelector(`[data-project-loader="${layout}"]`)).toBeTruthy();
    }
  });
});
