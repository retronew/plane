import { useRef } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import type { TIssue } from "@plane/types";
import { IssueTitleInput } from "./title-input";

vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@plane/utils", () => ({ getTabIndex: () => ({ getIndex: () => 0 }) }));
vi.mock("@/hooks/use-platform-os", () => ({ usePlatformOS: () => ({ isMobile: false }) }));

function Harness({ onSubmit, onChange }: { onSubmit: (issue: TIssue) => void; onChange: () => void }) {
  const { control, formState, handleSubmit } = useForm<TIssue>({ defaultValues: { name: "" } });
  const titleRef = useRef<HTMLInputElement | null>(null);
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <IssueTitleInput control={control} formState={formState} issueTitleRef={titleRef} handleFormChange={onChange} />
      <button type="button" onClick={() => titleRef.current?.focus()}>
        Focus title
      </button>
      <button type="submit">Create</button>
    </form>
  );
}

describe("composer title", () => {
  it.each([
    ["   ", "title_is_required"],
    ["x".repeat(256), "title_should_be_less_than_255_characters"],
  ])("keeps validation and links the error to the borderless field", async (title, error) => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} onChange={vi.fn()} />);
    const input = screen.getByRole("textbox", { name: "title" });
    fireEvent.change(input, { target: { value: title } });
    fireEvent.click(screen.getByText("Create"));
    expect((await screen.findByRole("alert")).textContent).toBe(error);
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe(screen.getByRole("alert").id);
    expect(onSubmit).not.toHaveBeenCalled();
    await waitFor(() => expect(document.activeElement).toBe(input));
  });

  it("preserves change tracking, imperative focus and the submitted title", async () => {
    const onSubmit = vi.fn();
    const onChange = vi.fn();
    render(<Harness onSubmit={onSubmit} onChange={onChange} />);
    const input = screen.getByRole("textbox", { name: "title" });
    fireEvent.change(input, { target: { value: "A new work item" } });
    expect(onChange).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByText("Focus title"));
    expect(document.activeElement).toBe(input);
    fireEvent.click(screen.getByText("Create"));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0].name).toBe("A new work item");
  });
});
