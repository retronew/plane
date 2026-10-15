import { render, screen, fireEvent } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { StateGroupPanel } from "./group-panel";
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
it("keeps states visible and exposes only the add action in the group heading", () => {
  const add = vi.fn();
  render(
    <StateGroupPanel title="Planning" onAdd={add}>
      <input aria-label="Draft" defaultValue="Unfinished state" />
    </StateGroupPanel>
  );
  expect(screen.getByRole("heading", { name: "Planning" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Planning" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "common.add Planning" }));
  expect(add).toHaveBeenCalledTimes(1);
  expect((screen.getByRole("textbox", { name: "Draft" }) as HTMLInputElement).value).toBe("Unfinished state");
});
