import { act, fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { AuthEmailForm } from "./email";

vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

it("restores submission after a rejected email check", async () => {
  let reject: (error: Error) => void = () => {};
  const onSubmit = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, fail) => {
          reject = fail;
        })
    )
    .mockResolvedValue(undefined);
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  render(<AuthEmailForm defaultEmail="test@example.com" onSubmit={onSubmit} />);
  const button = screen.getByRole("button", { name: "common.continue" });
  fireEvent.click(button);
  expect(button.getAttribute("aria-disabled") === "true").toBe(true);
  await act(async () => reject(new Error("offline")));
  expect(button.getAttribute("aria-disabled") === "true").toBe(false);
  fireEvent.click(button);
  await act(async () => {});
  expect(onSubmit).toHaveBeenCalledTimes(2);
  expect(onSubmit).toHaveBeenLastCalledWith({ email: "test@example.com" });
  expect(button.getAttribute("aria-disabled") === "true").toBe(false);
  log.mockRestore();
});
