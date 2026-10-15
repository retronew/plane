import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { LinkCreateUpdateModal } from "./create-update-link-modal";

vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  translate: (key: string) => key,
}));
const operations = { create: vi.fn(), update: vi.fn(), remove: vi.fn() };
const close = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  operations.create.mockResolvedValue(undefined);
  operations.update.mockResolvedValue(undefined);
});

it("marks only the URL as required and accepts an empty display title", async () => {
  render(<LinkCreateUpdateModal isModalOpen linkOperations={operations} handleOnClose={close} />);
  const url = screen.getByRole("textbox", { name: "link.modal.url.text" });
  const title = screen.getByRole("textbox", { name: "link.modal.title.text" });
  expect(url.getAttribute("aria-required")).toBe("true");
  expect(title.getAttribute("aria-required")).not.toBe("true");
  expect(document.querySelectorAll("label span[aria-hidden='true']")).toHaveLength(1);
  expect(screen.queryByText("required")).toBeNull();
  expect(screen.queryByText("optional")).toBeNull();
  fireEvent.change(url, { target: { value: "example.com" } });
  fireEvent.submit(url.closest("form")!);
  await waitFor(() => expect(operations.create).toHaveBeenCalledWith({ url: "http://example.com", title: "" }));
  expect(close).toHaveBeenCalledOnce();
});

it("keeps the form open and shows the URL error when the required field is empty", async () => {
  render(<LinkCreateUpdateModal isModalOpen linkOperations={operations} handleOnClose={close} />);
  fireEvent.submit(screen.getByRole("textbox", { name: "link.modal.url.text" }).closest("form")!);
  expect(await screen.findByText("link.modal.url.required")).toBeTruthy();
  expect(operations.create).not.toHaveBeenCalled();
  expect(close).not.toHaveBeenCalled();
});

it("allows clearing the optional title when editing an existing link", async () => {
  render(
    <LinkCreateUpdateModal
      isModalOpen
      linkOperations={operations}
      handleOnClose={close}
      preloadedData={{ id: "link-1", url: "https://example.com", title: "Example" }}
    />
  );
  const title = screen.getByRole("textbox", { name: "link.modal.title.text" });
  fireEvent.change(title, { target: { value: "" } });
  fireEvent.submit(title.closest("form")!);
  await waitFor(() =>
    expect(operations.update).toHaveBeenCalledWith("link-1", { url: "https://example.com", title: "" })
  );
  expect(operations.create).not.toHaveBeenCalled();
});
