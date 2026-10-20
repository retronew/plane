import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { IModule } from "@plane/types";
import { ModuleStatusDropdown } from "./module-status-dropdown";
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

it("renders list and gallery status with the shared 20px pill and visible text", () => {
  render(
    <ModuleStatusDropdown
      variant="pill-sm"
      isDisabled={false}
      moduleDetails={{ status: "planned" } as IModule}
      handleModuleDetailsChange={vi.fn()}
    />
  );
  const button = screen.getByRole("button", { name: "project_modules.status.planned" });
  expect(button.className).toContain("h-5");
  expect(button.className).toContain("rounded-lg");
  expect(button.textContent).toBeTruthy();
  expect(button.querySelector("svg")).toBeTruthy();
  expect(button.querySelector("[style*='background-color']")).toBeNull();
});
