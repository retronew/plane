import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { CreateWorkspaceForm } from "./create-workspace-form";

const state = vi.hoisted(() => ({ check: vi.fn(), create: vi.fn(), toast: vi.fn(), suggest: vi.fn(), ai: true }));
vi.mock("@/hooks/store/use-instance", () => ({ useInstance: () => ({ config: { has_llm_configured: state.ai } }) }));
vi.mock("@/services/ai.service", () => ({
  AIService: class {
    suggestWorkspaceSlug = state.suggest;
  },
}));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@plane/blocks/toast", () => ({ setToast: state.toast }));
vi.mock("@/hooks/store/use-workspace", () => ({ useWorkspace: () => ({ createWorkspace: state.create }) }));
vi.mock("@/hooks/use-app-router", () => ({ useAppRouter: () => ({ back: vi.fn() }) }));
vi.mock("@/services/workspace.service", () => ({
  WorkspaceService: class {
    workspaceSlugCheck = state.check;
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  state.ai = true;
  state.suggest.mockResolvedValue({ slug: "moon-team" });
  state.check.mockResolvedValue({ status: true });
  state.create.mockResolvedValue({ id: "workspace" });
});

function setup() {
  render(<CreateWorkspaceForm defaultValues={{ name: "", slug: "" }} setDefaultValues={vi.fn()} />);
  return {
    name: screen.getByLabelText(/workspace_creation.form.name.label/) as HTMLInputElement,
    slug: screen.getByLabelText(/workspace_creation.form.url.label/) as HTMLInputElement,
  };
}

it.each([
  ["中文Team_One-123", "team_one-123"],
  ["中文工作区", ""],
  ["My Team", "my-team"],
])("keeps the name %s and generates an ASCII URL", (name, slug) => {
  const fields = setup();
  fireEvent.change(fields.name, { target: { value: name } });
  expect(fields.name.value).toBe(name);
  expect(fields.slug.value).toBe(slug);
});

it("blocks an empty URL generated from a Chinese name", async () => {
  const fields = setup();
  fireEvent.change(fields.name, { target: { value: "中文名称" } });
  fireEvent.submit(fields.name.closest("form")!);
  await screen.findByText("workspace_creation.errors.validation.url_required");
  expect(state.check).not.toHaveBeenCalled();
});

it("blocks invalid manual input and normalizes it on blur without interrupting composition", async () => {
  const fields = setup();
  fireEvent.change(fields.name, { target: { value: "中文名称" } });
  fireEvent.change(fields.slug, { target: { value: "中文Team_1-2!" } });
  expect(fields.slug.value).toBe("中文Team_1-2!");
  fireEvent.submit(fields.slug.closest("form")!);
  await screen.findByText("workspace_creation.errors.validation.url_alphanumeric");
  expect(state.check).not.toHaveBeenCalled();
  fireEvent.blur(fields.slug);
  expect(fields.slug.value).toBe("team_1-2");
  fireEvent.submit(fields.slug.closest("form")!);
  await waitFor(() =>
    expect(state.create).toHaveBeenCalledWith(expect.objectContaining({ name: "中文名称", slug: "team_1-2" }))
  );
});

it("shows backend field errors next to the field", async () => {
  state.create.mockRejectedValue({ slug: ["This URL is unavailable."] });
  const fields = setup();
  fireEvent.change(fields.name, { target: { value: "My Team" } });
  fireEvent.submit(fields.name.closest("form")!);
  await screen.findByText("This URL is unavailable.");
  expect(state.toast).not.toHaveBeenCalled();
});

it("shows AI only when configured and requires a name", () => {
  const fields = setup();
  const button = screen.getByRole("button", { name: "workspace_creation.form.url.ai_suggest" });
  expect((button as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(fields.name, { target: { value: "月亮团队" } });
  expect((button as HTMLButtonElement).disabled).toBe(false);
});

it("hides AI without instance configuration", () => {
  state.ai = false;
  setup();
  expect(screen.queryByRole("button", { name: "workspace_creation.form.url.ai_suggest" })).toBeNull();
});

it("suggests a valid available URL from the name without submitting", async () => {
  const fields = setup();
  fireEvent.change(fields.name, { target: { value: "月亮团队" } });
  fireEvent.click(screen.getByRole("button", { name: "workspace_creation.form.url.ai_suggest" }));
  await waitFor(() => expect(fields.slug.value).toBe("moon-team"));
  expect(state.suggest).toHaveBeenCalledWith("月亮团队");
  expect(state.create).not.toHaveBeenCalled();
});

it("preserves manual edits made during generation", async () => {
  let resolve!: (value: { slug: string }) => void;
  state.suggest.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    })
  );
  const fields = setup();
  fireEvent.change(fields.name, { target: { value: "月亮团队" } });
  fireEvent.click(screen.getByRole("button", { name: "workspace_creation.form.url.ai_suggest" }));
  fireEvent.change(fields.slug, { target: { value: "manual" } });
  resolve({ slug: "moon-team" });
  await waitFor(() =>
    expect(
      (screen.getByRole("button", { name: "workspace_creation.form.url.ai_suggest" }) as HTMLButtonElement).disabled
    ).toBe(false)
  );
  expect(fields.slug.value).toBe("manual");
});

it.each(["invalid slug", "api"])("rejects AI output %s and preserves the current URL", async (slug) => {
  state.suggest.mockResolvedValueOnce({ slug });
  const fields = setup();
  fireEvent.change(fields.name, { target: { value: "My team" } });
  fireEvent.click(screen.getByRole("button", { name: "workspace_creation.form.url.ai_suggest" }));
  await waitFor(() => expect(state.toast).toHaveBeenCalled());
  expect(fields.slug.value).toBe("my-team");
});

it("reports unavailable suggestions without replacing the URL", async () => {
  state.check.mockResolvedValueOnce({ status: false });
  const fields = setup();
  fireEvent.change(fields.name, { target: { value: "My team" } });
  fireEvent.click(screen.getByRole("button", { name: "workspace_creation.form.url.ai_suggest" }));
  await waitFor(() =>
    expect(state.toast).toHaveBeenCalledWith(
      expect.objectContaining({ message: "workspace_creation.form.url.ai_taken" })
    )
  );
  expect(fields.slug.value).toBe("my-team");
});
