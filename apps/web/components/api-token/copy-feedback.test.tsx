import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setToast } from "@plane/blocks/toast";
import { ApiTokenCopyButton } from "./copy-feedback";

vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@plane/blocks/toast", () => ({ setToast: vi.fn() }));
const writeText = vi.fn();
beforeEach(() => {
  vi.useFakeTimers();
  writeText.mockReset().mockResolvedValue(undefined);
  vi.mocked(setToast).mockClear();
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
const clickCopy = async () => {
  await act(async () => fireEvent.click(screen.getByRole("button")));
};

describe("API token copy feedback", () => {
  it("waits for clipboard completion and resets the two-second timer on repeat copy", async () => {
    let resolveCopy!: () => void;
    writeText.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveCopy = resolve;
      })
    );
    render(<ApiTokenCopyButton value="command" label="Copy command" />);
    await clickCopy();
    expect(screen.getByRole("button").textContent).toContain("Copy command");
    expect(screen.getByRole("status").textContent).toBe("");
    await act(async () => resolveCopy());
    expect(screen.getByRole("status").textContent).toBe("common.copied");
    act(() => vi.advanceTimersByTime(1500));
    await clickCopy();
    act(() => vi.advanceTimersByTime(1500));
    expect(screen.getByRole("status").textContent).toBe("common.copied");
    act(() => vi.advanceTimersByTime(500));
    expect(screen.getByRole("button", { name: "Copy command" })).toBeTruthy();
    expect(writeText).toHaveBeenCalledWith("command");
  });

  it("reports failures without success and ignores stale async completions", async () => {
    let resolveCopy!: () => void;
    writeText.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveCopy = resolve;
      })
    );
    render(<ApiTokenCopyButton value="secret" label="Copy" />);
    await clickCopy();
    writeText.mockRejectedValueOnce(new Error("Denied"));
    await clickCopy();
    await act(async () => resolveCopy());
    expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy();
    expect(setToast).toHaveBeenCalledWith(expect.objectContaining({ type: "error" }));
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cleans up timers and pending writes on unmount", async () => {
    const first = render(<ApiTokenCopyButton value="secret" label="Copy" />);
    await clickCopy();
    expect(vi.getTimerCount()).toBe(1);
    first.unmount();
    expect(vi.getTimerCount()).toBe(0);
    let resolveCopy!: () => void;
    writeText.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveCopy = resolve;
      })
    );
    const second = render(<ApiTokenCopyButton value="secret" label="Copy" />);
    await clickCopy();
    second.unmount();
    await act(async () => resolveCopy());
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not claim success when the legacy clipboard fallback returns false", async () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    Object.defineProperty(document, "execCommand", { configurable: true, value: vi.fn(() => false) });
    render(<ApiTokenCopyButton value="secret" label="Copy" />);
    await clickCopy();
    expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy();
    expect(document.querySelector("textarea")).toBeNull();
    expect(setToast).toHaveBeenCalledWith(expect.objectContaining({ type: "error" }));
  });
});
