import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { EIssueLayoutTypes } from "@plane/types";
import { LayoutSelection } from "./layout-selection";
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/use-platform-os", () => ({ usePlatformOS: () => ({ isMobile: false }) }));
it("exposes four real tabs, selects the current mode and only changes on a different pick", () => {
  const onChange = vi.fn();
  render(
    <LayoutSelection
      layouts={[
        EIssueLayoutTypes.LIST,
        EIssueLayoutTypes.KANBAN,
        EIssueLayoutTypes.CALENDAR,
        EIssueLayoutTypes.SPREADSHEET,
      ]}
      selectedLayout={EIssueLayoutTypes.LIST}
      onChange={onChange}
    />
  );
  expect(screen.getAllByRole("tab")).toHaveLength(4);
  expect(screen.getByRole("tab", { selected: true }).getAttribute("data-testid")).toBe("layout-switch-list");
  fireEvent.click(screen.getByTestId("layout-switch-list"));
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.click(screen.getByTestId("layout-switch-calendar"));
  expect(onChange).toHaveBeenCalledWith(EIssueLayoutTypes.CALENDAR);
});
it("does not expose layouts the page does not support", () => {
  render(
    <LayoutSelection layouts={[EIssueLayoutTypes.LIST]} selectedLayout={EIssueLayoutTypes.LIST} onChange={vi.fn()} />
  );
  expect(screen.getAllByRole("tab")).toHaveLength(1);
  expect(screen.queryByTestId("layout-switch-calendar")).toBeNull();
});
