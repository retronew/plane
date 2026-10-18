import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { CustomPropertyFields } from "./custom-properties";
import type { TCustomProperty } from "@/services/project/custom-properties.types";

vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@plane/blocks/toast", () => ({ setToast: vi.fn() }));
vi.mock("@/components/dropdowns/member/member-select", () => ({ MemberSelect: () => null }));
vi.mock("@/hooks/use-issue-properties", () => ({ useWorkItemProperties: vi.fn() }));
const property: TCustomProperty = {
  id: "p",
  name: "Customer",
  description: "",
  property_type: "text",
  config: {},
  is_active: true,
  is_required: false,
  sort_order: 0,
  options: [],
  options_version: "v1",
  type_settings: [],
};
beforeEach(() => vi.clearAllMocks());

it("edits locally and saves once on blur, retaining the input after failure and retrying", async () => {
  const save = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
  render(<CustomPropertyFields properties={[property]} values={{ p: "before" }} projectId="project" onSave={save} />);
  const input = screen.getByRole("textbox", { name: "Customer" }) as HTMLInputElement;
  fireEvent.change(input, { target: { value: "a" } });
  fireEvent.change(input, { target: { value: "after" } });
  expect(save).not.toHaveBeenCalled();
  fireEvent.blur(input);
  await screen.findByRole("alert");
  expect(input.value).toBe("after");
  expect(save).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "web.work_item_properties.retry" }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  expect(save).toHaveBeenLastCalledWith({ p: "after" });
});

it("does not write for permission-disabled fields or read-only configured text", () => {
  const save = vi.fn();
  const view = render(
    <CustomPropertyFields properties={[property]} values={{ p: "fixed" }} projectId="project" disabled onSave={save} />
  );
  expect((screen.getByRole("textbox", { name: "Customer" }) as HTMLInputElement).disabled).toBe(true);
  view.rerender(
    <CustomPropertyFields
      properties={[{ ...property, config: { read_only: true } }]}
      values={{ p: "fixed" }}
      projectId="project"
      onSave={save}
    />
  );
  expect((screen.getByRole("textbox", { name: "Customer" }) as HTMLInputElement).disabled).toBe(true);
  fireEvent.blur(screen.getByRole("textbox"));
  expect(save).not.toHaveBeenCalled();
});

it("clears optional text using null and validates required fields before saving", async () => {
  const save = vi.fn().mockResolvedValue(undefined);
  const view = render(
    <CustomPropertyFields properties={[property]} values={{ p: "before" }} projectId="project" onSave={save} />
  );
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "" } });
  fireEvent.blur(screen.getByRole("textbox"));
  await waitFor(() => expect(save).toHaveBeenCalledWith({ p: null }));
  view.unmount();
  save.mockClear();
  render(
    <CustomPropertyFields
      properties={[{ ...property, is_required: true }]}
      values={{ p: "before" }}
      projectId="project"
      onSave={save}
    />
  );
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "" } });
  fireEvent.blur(screen.getByRole("textbox"));
  await screen.findByRole("alert");
  expect(save).not.toHaveBeenCalled();
});
