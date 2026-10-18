import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { SelectChannel } from "./select-channel";

const mocks = vi.hoisted(() => ({
  data: [] as { id: string; project: string }[],
  mutate: vi.fn(),
  remove: vi.fn(),
  auth: vi.fn(),
}));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "test", projectId: "project" }) }));
vi.mock("@/hooks/store/use-instance", () => ({ useInstance: () => ({ config: {} }) }));
vi.mock("@/hooks/use-integration-popup", () => ({ default: () => ({ startAuth: mocks.auth }) }));
vi.mock("@/services/app_installation.service", () => ({
  AppInstallationService: class {
    removeSlackChannel = mocks.remove;
  },
}));
vi.mock("swr", () => ({ default: () => ({ data: mocks.data, mutate: mocks.mutate }) }));
vi.mock("@plane/i18n", () => ({ translate: (key: string) => key }));
const integration = { id: "integration" } as React.ComponentProps<typeof SelectChannel>["integration"];
beforeEach(() => {
  mocks.data = [{ id: "channel", project: "project" }];
  mocks.remove.mockReset().mockResolvedValue({});
  mocks.mutate.mockReset();
  mocks.auth.mockReset();
});
it("reflects channel removal from refreshed data", () => {
  const { rerender } = render(<SelectChannel integration={integration} />);
  expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("true");
  mocks.data = [];
  rerender(<SelectChannel integration={integration} />);
  expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("false");
  fireEvent.click(screen.getByRole("switch"));
  expect(mocks.auth).toHaveBeenCalledOnce();
});
it("preserves the cache on failure and filters only the deleted channel on retry", async () => {
  mocks.remove.mockRejectedValueOnce(new Error("offline"));
  const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
  render(<SelectChannel integration={integration} />);
  fireEvent.click(screen.getByRole("switch"));
  await waitFor(() => expect((screen.getByRole("switch") as HTMLButtonElement).disabled).toBe(false));
  expect(mocks.mutate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("switch"));
  await waitFor(() => expect(mocks.mutate).toHaveBeenCalledOnce());
  const filter = mocks.mutate.mock.calls[0][0];
  expect(filter([...mocks.data, { id: "other", project: "other" }])).toEqual([{ id: "other", project: "other" }]);
  error.mockRestore();
});
