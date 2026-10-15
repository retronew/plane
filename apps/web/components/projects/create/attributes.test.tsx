import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { IProject } from "@plane/types";
import { ProjectAttributes } from "./attributes";
const submit = vi.fn();
vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key, currentLocale: "en" }),
  getCurrentLanguage: () => "en",
}));
vi.mock("@/hooks/store/user", () => ({ useUserProfile: () => ({ data: { start_of_the_week: 1 } }) }));
vi.mock("@/components/dropdowns/member/member-select", () => ({
  MemberSelect: ({ onChange, multiple }: { onChange: (id: string | string[]) => void; multiple?: boolean }) => (
    <button type="button" onClick={() => onChange(multiple ? ["member-1", "member-2"] : "lead-1")}>
      {multiple ? "Pick members" : "Pick lead"}
    </button>
  ),
}));
function Form() {
  const methods = useForm<IProject>({ defaultValues: { network: 2, project_lead: null } });
  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(submit)}>
        <ProjectAttributes />
        <button type="submit">Save</button>
      </form>
    </FormProvider>
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(1024);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(768);
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(240);
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(320);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(new DOMRect(100, 100, 320, 32));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  Object.defineProperty(Element.prototype, "getAnimations", { configurable: true, value: () => [] });
  Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: () => undefined });
});
afterEach(() => vi.restoreAllMocks());
it("saves the private network value zero instead of treating it as empty", async () => {
  render(<Form />);
  fireEvent.click(screen.getByRole("button", { name: /network.public.title/ }));
  const option = await screen.findByRole("option", { name: /network.private.title/ });
  fireEvent.pointerDown(option, { pointerType: "mouse", button: 0 });
  fireEvent.click(option);
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(submit).toHaveBeenCalledWith(expect.objectContaining({ network: 0 }), expect.anything()));
});
it("keeps the lead selector bound to the creation form", async () => {
  render(<Form />);
  fireEvent.click(screen.getByRole("button", { name: "Pick lead" }));
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() =>
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ project_lead: "lead-1" }), expect.anything())
  );
});

it("keeps initial members bound separately from the project lead", async () => {
  render(<Form />);
  fireEvent.click(screen.getByRole("button", { name: "Pick members" }));
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() =>
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({ member_ids: ["member-1", "member-2"], project_lead: null }),
      expect.anything()
    )
  );
});
