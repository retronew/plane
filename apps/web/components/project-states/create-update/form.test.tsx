import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { StateForm } from "./form";
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
afterEach(() => vi.unstubAllGlobals());
it("validates blank names and submits a trimmed name with the description", async () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  const submit = vi.fn().mockResolvedValue({ status: "success" });
  render(
    <StateForm
      data={{ name: "", color: "#60646c" }}
      onSubmit={submit}
      onCancel={vi.fn()}
      buttonDisabled={false}
      buttonTitle="Save"
    />
  );
  const name = screen.getByPlaceholderText("web.name");
  fireEvent.change(name, { target: { value: "   " } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(submit).not.toHaveBeenCalled();
  fireEvent.change(name, { target: { value: "  Ready  " } });
  fireEvent.change(screen.getByPlaceholderText("web.describe_this_state_for_your_members"), {
    target: { value: "Approved" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() =>
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Ready", description: "Approved", color: "#60646c" })
    )
  );
});

it("uses form submission, blocks duplicate saves and retains edits on failure", async () => {
  let finish!: (result: { status: string }) => void;
  const submit = vi.fn(
    () =>
      new Promise<{ status: string }>((resolve) => {
        finish = resolve;
      })
  );
  const cancel = vi.fn();
  render(
    <StateForm
      data={{ name: "Ready", color: "#60646c" }}
      onSubmit={submit}
      onCancel={cancel}
      buttonDisabled={false}
      buttonTitle="Save"
    />
  );
  const name = screen.getByRole("textbox", { name: "web.name" });
  const form = name.closest("form")!;
  fireEvent.submit(form);
  fireEvent.submit(form);
  expect(submit).toHaveBeenCalledTimes(1);
  expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
  finish({ status: "error" });
  await screen.findByRole("alert");
  expect((name as HTMLInputElement).value).toBe("Ready");
  fireEvent.keyDown(name, { key: "Escape" });
  expect(cancel).toHaveBeenCalledTimes(1);
});
