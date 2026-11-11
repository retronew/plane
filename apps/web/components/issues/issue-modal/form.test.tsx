import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useFormContext } from "react-hook-form";
import { afterEach, expect, it, vi } from "vitest";
import type { TIssue } from "@plane/types";
import { IssueFormRoot } from "./form";

const mocks = vi.hoisted(() => ({
  submit: vi.fn().mockResolvedValue(undefined),
  fetch: vi.fn(),
  set: vi.fn(),
  validate: vi.fn(() => true),
  prepare: vi.fn(() => ({})),
  editorReady: true as boolean | null,
  toast: vi.fn(),
}));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "w", projectId: "p" }) }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@plane/blocks/toast", () => ({ setToast: mocks.toast }));
vi.mock("@/components/settings/workspace/configuration/template-picker", () => ({ TemplatePicker: () => null }));
vi.mock("@/components/issues/custom-properties", () => ({ CustomPropertyFields: () => null }));
vi.mock("@/hooks/use-default-issue-type", () => ({ useDefaultIssueType: () => undefined }));
vi.mock("@/hooks/use-platform-os", () => ({ usePlatformOS: () => ({ isMobile: false }) }));
vi.mock("@/hooks/use-project-issue-properties", () => ({
  useProjectIssueProperties: () => ({ fetchCycles: mocks.fetch }),
}));
vi.mock("@/hooks/store/use-project", () => ({ useProject: () => ({ getProjectById: mocks.fetch }) }));
vi.mock("@/hooks/store/use-project-state", () => ({ useProjectState: () => ({ getStateById: mocks.fetch }) }));
vi.mock("@/hooks/store/use-project-workflow", () => ({
  useProjectWorkflow: () => ({ issueTypes: {}, resolve: mocks.fetch }),
}));
vi.mock("@/hooks/store/use-issue-detail", () => ({ useIssueDetail: () => ({ issue: { getIssueById: mocks.fetch } }) }));
vi.mock("@/hooks/store/workspace-draft", () => ({ useWorkspaceDraftIssues: () => ({ moveIssue: mocks.fetch }) }));
vi.mock("@/hooks/context/use-issue-modal", () => ({
  useIssueModal: () => ({
    handleProjectEntitiesFetch: mocks.fetch,
    setCustomPropertyValues: mocks.set,
    customPropertyValues: {},
    customProperties: [],
    customPropertyErrors: {},
    handlePropertyValuesValidation: mocks.validate,
    prepareCustomProperties: mocks.prepare,
    setWorkItemTemplateId: mocks.set,
    setSelectedParentIssue: mocks.set,
  }),
}));
vi.mock("@makeplane/propel/components/dialog", () => {
  const Div = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  return { DialogActions: Div, DialogBody: Div, DialogInfo: Div, DialogMain: Div, DialogTitle: Div };
});
vi.mock("@makeplane/propel/components/button", () => ({
  Button: ({
    label,
    loading: _loading,
    stretch: _stretch,
    ...props
  }: React.ComponentProps<"button"> & { label: string; loading?: boolean; stretch?: string }) => (
    <button {...props}>{label}</button>
  ),
}));
vi.mock("@makeplane/propel/components/icon-button", () => ({
  IconButton: ({ onClick, "aria-label": label }: React.ComponentProps<"button">) => (
    <button type="button" aria-label={label} onClick={onClick} />
  ),
}));
vi.mock("@/components/issues/issue-modal/components", () => {
  function Fields() {
    const { register, watch } = useFormContext<TIssue>();
    return (
      <>
        <input aria-label="name" {...register("name")} />
        <input aria-label="state" {...register("state_id")} />
        <input aria-label="priority" {...register("priority")} />
        <output data-testid="assignees">{watch("assignee_ids")?.join(",")}</output>
      </>
    );
  }
  return {
    IssueTitleInput: Fields,
    IssueDefaultProperties: () => null,
    IssueParentTag: () => null,
    IssueProjectSelect: () => null,
    IssueDescriptionEditor: ({ editorRef }: { editorRef: React.MutableRefObject<unknown> }) => {
      editorRef.current =
        mocks.editorReady === null
          ? null
          : { isEditorReadyToDiscard: () => mocks.editorReady, clearEditor: () => undefined };
      const { register } = useFormContext<TIssue>();
      return <textarea aria-label="description" {...register("description_html")} />;
    },
  };
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.editorReady = true;
});
const initial = {
  id: "a",
  project_id: "p",
  name: "Original",
  state_id: "s1",
  priority: "low",
  assignee_ids: ["u1"],
  description_html: "Original description",
} as Partial<TIssue>;
function view(
  data?: Partial<TIssue>,
  dataResetProperties?: unknown[],
  overrides?: Partial<React.ComponentProps<typeof IssueFormRoot>>
) {
  return (
    <IssueFormRoot
      data={data}
      dataResetProperties={dataResetProperties}
      projectId="p"
      issueTitleRef={{ current: null }}
      isCreateMoreToggleEnabled={false}
      onAssetUpload={mocks.set}
      onCreateMoreToggleChange={mocks.set}
      onClose={mocks.set}
      onSubmit={mocks.submit}
      isDraft={false}
      isDuplicateModalOpen={false}
      handleDuplicateIssueModal={mocks.set}
      {...overrides}
    />
  );
}
it("allows closing and discarding before the description editor mounts", () => {
  mocks.editorReady = null;
  const onClose = vi.fn();
  const onDiscard = vi.fn();
  const closeRequestRef = { current: null as (() => void) | null };
  render(view(undefined, undefined, { projectId: undefined, onClose, onDiscard, closeRequestRef }));

  fireEvent.click(screen.getByRole("button", { name: "close" }));
  expect(onClose).toHaveBeenCalledTimes(1);
  closeRequestRef.current?.();
  expect(onClose).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole("button", { name: "web.discard" }));
  expect(onDiscard).toHaveBeenCalledTimes(1);
  expect(mocks.toast).not.toHaveBeenCalled();
});
it("preserves entered values through the draft callback before the editor mounts", () => {
  mocks.editorReady = null;
  const onKeepDraft = vi.fn();
  const onClose = vi.fn();
  render(view(undefined, undefined, { projectId: undefined, onKeepDraft, onClose }));
  fireEvent.change(screen.getByLabelText("name"), { target: { value: "Unselected project draft" } });
  fireEvent.click(screen.getByRole("button", { name: "close" }));
  expect(onKeepDraft).toHaveBeenCalledWith(expect.objectContaining({ name: "Unselected project draft" }), true);
  expect(onClose).not.toHaveBeenCalled();
});
it("still blocks all dismissal paths while the editor uploads a file", () => {
  mocks.editorReady = false;
  const onClose = vi.fn();
  const onDiscard = vi.fn();
  const closeRequestRef = { current: null as (() => void) | null };
  render(view(undefined, undefined, { onClose, onDiscard, closeRequestRef }));

  fireEvent.click(screen.getByRole("button", { name: "close" }));
  closeRequestRef.current?.();
  fireEvent.click(screen.getByRole("button", { name: "web.discard" }));
  expect(onClose).not.toHaveBeenCalled();
  expect(onDiscard).not.toHaveBeenCalled();
  expect(mocks.toast).toHaveBeenCalledTimes(3);
});
it("does not submit a work item while the editor is unavailable", async () => {
  mocks.editorReady = null;
  render(view(initial));
  fireEvent.click(screen.getByRole("button", { name: "update" }));
  await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
  expect(mocks.submit).not.toHaveBeenCalled();
});
it("merges remote title, state, priority and assignees using real react-hook-form", () => {
  const { rerender } = render(view(initial));
  rerender(view({ ...initial, name: "Remote", state_id: "s2", priority: "urgent", assignee_ids: ["u2"] }));
  expect((screen.getByLabelText("name") as HTMLInputElement).value).toBe("Remote");
  expect((screen.getByLabelText("state") as HTMLInputElement).value).toBe("s2");
  expect((screen.getByLabelText("priority") as HTMLInputElement).value).toBe("urgent");
  expect(screen.getByTestId("assignees").textContent).toBe("u2");
});
it("keeps dirty title and description after blur and repeated remote merges, submits only edits", async () => {
  const { rerender } = render(view(initial));
  fireEvent.change(screen.getByLabelText("name"), { target: { value: "Local" } });
  fireEvent.change(screen.getByLabelText("description"), { target: { value: "Local description" } });
  fireEvent.blur(screen.getByLabelText("name"));
  rerender(view({ ...initial, name: "Remote", state_id: "s2", description_html: "Remote description" }));
  rerender(view({ ...initial, name: "Remote again", state_id: "s3", description_html: "Remote again" }));
  expect((screen.getByLabelText("name") as HTMLInputElement).value).toBe("Local");
  expect((screen.getByLabelText("description") as HTMLTextAreaElement).value).toBe("Local description");
  expect((screen.getByLabelText("state") as HTMLInputElement).value).toBe("s3");
  fireEvent.click(screen.getByRole("button", { name: "update" }));
  await waitFor(() => expect(mocks.submit).toHaveBeenCalled());
  const payload = mocks.submit.mock.calls[0][0];
  expect(payload).toMatchObject({ name: "Local", description_html: "Local description" });
  expect(payload).not.toHaveProperty("state_id");
  expect(payload).not.toHaveProperty("type_id");
});
it("does not submit untouched description", async () => {
  render(view(initial));
  fireEvent.change(screen.getByLabelText("name"), { target: { value: "Local" } });
  fireEvent.click(screen.getByRole("button", { name: "update" }));
  await waitFor(() => expect(mocks.submit).toHaveBeenCalled());
  expect(mocks.submit.mock.calls[0][0]).not.toHaveProperty("description_html");
});
it("resets dirty fields when switching issue identity", () => {
  const { rerender } = render(view(initial));
  fireEvent.change(screen.getByLabelText("name"), { target: { value: "Local" } });
  rerender(view({ ...initial, id: "b", name: "Second" }));
  expect((screen.getByLabelText("name") as HTMLInputElement).value).toBe("Second");
});
it("preserves new drafts and tolerates equivalent reset property arrays", () => {
  const { rerender } = render(view({ name: "Draft" }, ["same"]));
  fireEvent.change(screen.getByLabelText("name"), { target: { value: "Local draft" } });
  rerender(view({ name: "Another default" }, ["same"]));
  expect((screen.getByLabelText("name") as HTMLInputElement).value).toBe("Local draft");
  rerender(view({ name: "Explicit reset" }, ["changed"]));
  expect((screen.getByLabelText("name") as HTMLInputElement).value).toBe("Explicit reset");
});
