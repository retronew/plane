import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { TPageInstance } from "@/store/pages/base-page";
import { PageLabels } from "./page-labels";

const mocks = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock("@plane/blocks/toast", () => ({ setToast: mocks.toast }));
vi.mock("@plane/i18n", () => ({ translate: (key: string) => key }));
vi.mock("@/components/dropdowns/label/label-select", () => ({
  LabelSelect: ({
    onChange,
    disabled,
    value,
  }: {
    onChange: (ids: string[]) => void;
    disabled: boolean;
    value: string[];
  }) => <button disabled={disabled} onClick={() => onChange(value.length ? [] : ["label"])} aria-label="Labels" />,
}));

beforeEach(() => vi.clearAllMocks());
function fixture(overrides: Partial<TPageInstance> = {}) {
  return {
    project_ids: ["project"],
    label_ids: [],
    isContentEditable: true,
    update: vi.fn().mockResolvedValue({}),
    ...overrides,
  } as unknown as TPageInstance;
}

it("saves labels without navigating the row and blocks duplicate requests while pending", async () => {
  let resolve!: () => void;
  const update = vi.fn().mockImplementation(
    () =>
      new Promise<void>((done) => {
        resolve = done;
      })
  );
  const page = fixture({ update });
  const navigate = vi.fn();
  render(
    <div role="presentation" onClick={navigate}>
      <PageLabels page={page} />
    </div>
  );
  const trigger = screen.getByRole("button", { name: "Labels" });
  fireEvent.click(trigger);
  fireEvent.click(trigger);
  expect(update).toHaveBeenCalledExactlyOnceWith({ label_ids: ["label"] });
  expect(navigate).not.toHaveBeenCalled();
  expect(trigger.hasAttribute("disabled")).toBe(true);
  resolve();
  await waitFor(() => expect(trigger.hasAttribute("disabled")).toBe(false));
});

it("sends an empty array when deselecting the last label", async () => {
  const page = fixture({ label_ids: ["label"] });
  render(<PageLabels page={page} />);
  fireEvent.click(screen.getByRole("button", { name: "Labels" }));
  await waitFor(() => expect(page.update).toHaveBeenCalledWith({ label_ids: [] }));
});

it("does not allow edits when page permissions, lock or archive make content read-only", () => {
  const page = fixture({ isContentEditable: false });
  render(<PageLabels page={page} />);
  fireEvent.click(screen.getByRole("button", { name: "Labels" }));
  expect(page.update).not.toHaveBeenCalled();
});

it("reports a rejected save and re-enables the picker", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const page = fixture({ update: vi.fn().mockRejectedValue(new Error("Failed")) });
  render(<PageLabels page={page} />);
  const trigger = screen.getByRole("button", { name: "Labels" });
  fireEvent.click(trigger);
  await waitFor(() => expect(mocks.toast).toHaveBeenCalledOnce());
  expect(trigger.hasAttribute("disabled")).toBe(false);
  vi.mocked(console.error).mockRestore();
});
