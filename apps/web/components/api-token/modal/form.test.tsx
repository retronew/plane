import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { CreateApiTokenForm } from "./form";

vi.mock("@plane/i18n", () => ({
  getCurrentLanguage: () => "en",
  useTranslation: () => ({ t: (key: string) => key }),
  translate: (key: string) => key,
}));
vi.mock("@/hooks/store/user", () => ({ useUserProfile: () => ({ data: { start_of_the_week: 1 } }) }));
vi.mock("@plane/blocks/toast", () => ({ setToast: vi.fn() }));
vi.mock("@makeplane/propel/components/dialog", () => {
  const Container = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return Object.fromEntries(
    ["DialogActions", "DialogBody", "DialogHeader", "DialogHeading", "DialogInfo", "DialogMain", "DialogTitle"].map(
      (key) => [key, Container]
    )
  );
});
vi.mock("@plane/blocks/select", () => ({
  Select: Object.assign(
    ({
      getValues,
      value,
      onChange,
    }: {
      getValues: () => { key: string; label: string }[];
      value: { key: string };
      onChange: (value: string) => void;
    }) => (
      <select aria-label="expiry" value={value.key} onChange={(e) => onChange(e.target.value)}>
        {getValues().map((option) => (
          <option key={option.key} value={option.key}>
            {option.label}
          </option>
        ))}
      </select>
    ),
    { Trigger: () => null }
  ),
}));
vi.mock("@plane/blocks/property-select", () => ({
  DateSelect: ({ onChange }: { onChange: (value: Date) => void }) => (
    <button type="button" onClick={() => onChange(new Date(Date.now() + 86400000 * 7))}>
      Choose date
    </button>
  ),
}));

describe("token expiry choices", () => {
  beforeEach(() =>
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    )
  );
  afterEach(() => vi.unstubAllGlobals());
  it("uses one mutually exclusive expiry choice and sends null for never expires", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<CreateApiTokenForm handleClose={vi.fn()} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByRole("textbox", { name: "title" }), { target: { value: "QA" } });
    expect(screen.getAllByRole("switch")).toHaveLength(1);
    fireEvent.change(screen.getByLabelText("expiry"), { target: { value: "never" } });
    fireEvent.click(screen.getByRole("button", { name: "workspace_settings.settings.api_tokens.generate_token" }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ expired_at: null, label: "QA" }))
    );
  });
  it("requires a chosen custom date before enabling generation", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<CreateApiTokenForm handleClose={vi.fn()} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByRole("textbox", { name: "title" }), { target: { value: "QA" } });
    fireEvent.change(screen.getByLabelText("expiry"), { target: { value: "custom" } });
    const generate = screen.getByRole<HTMLButtonElement>("button", {
      name: "workspace_settings.settings.api_tokens.generate_token",
    });
    expect(generate.disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Choose date" }));
    expect(generate.disabled).toBe(false);
    fireEvent.click(generate);
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(new Date(onSubmit.mock.calls[0][0].expired_at).getTime()).toBeGreaterThan(Date.now());
  });
});
