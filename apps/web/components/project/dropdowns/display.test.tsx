import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { ProjectDisplayMenu } from "./display";
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  Object.defineProperty(Element.prototype, "getAnimations", { configurable: true, value: () => [] });
});
for (const layout of ["gallery", "timeline"] as const)
  it(`${layout} exposes sorting without an irrelevant grouping control`, async () => {
    render(<ProjectDisplayMenu layout={layout} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "common.display" }));
    await screen.findByRole("menuitem", { name: /common.sort.field/ });
    expect(screen.queryByRole("menuitem", { name: /web.project_page.group_by/ })).toBeNull();
  });
for (const layout of ["board", "list"] as const)
  it(`${layout} connects all five grouping options to the view preference`, async () => {
    const change = vi.fn();
    render(<ProjectDisplayMenu layout={layout} onChange={vi.fn()} onGroupChange={change} />);
    fireEvent.click(screen.getByRole("button", { name: "common.display" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /web.project_page.group_by/ }));
    const radio = await screen.findByRole("menuitemradio", { name: "web.project_page.groupings.priority" });
    expect(screen.getAllByRole("menuitemradio")).toHaveLength(5);
    fireEvent.click(radio);
    expect(change).toHaveBeenCalledWith("priority");
  });
