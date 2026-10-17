/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { IProject } from "@plane/types";
import { ProjectOverviewDescription } from "./description";

const mocks = vi.hoisted(() => ({ updateProject: vi.fn(), toast: vi.fn() }));

vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/store/use-project", () => ({ useProject: () => ({ updateProject: mocks.updateProject }) }));
vi.mock("@plane/blocks/toast", () => ({ setToast: mocks.toast }));

const project = { id: "project-1", description: "Original description" } as IProject;
const placeholder = "common.click_to_add_description";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.updateProject.mockResolvedValue(undefined);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});
afterEach(() => vi.unstubAllGlobals());

function setup(description = project.description, disabled = false) {
  return render(
    <ProjectOverviewDescription project={{ ...project, description }} workspaceSlug="workspace" disabled={disabled} />
  );
}

function edit(value: string) {
  fireEvent.click(screen.getByRole("button"));
  const textarea = screen.getByRole<HTMLTextAreaElement>("textbox", { name: "description" });
  fireEvent.change(textarea, { target: { value } });
  return textarea;
}

it("shows the description as plain text and preserves empty lines", () => {
  const description = "First line\n\n<script>plain text</script>\nLast line";
  setup(description);
  const button = screen.getByRole("button");
  expect(button.textContent).toBe(description);
  expect(button.querySelector("script")).toBeNull();
  expect(button.querySelector("p")?.classList.contains("whitespace-pre-wrap")).toBe(true);
  expect(button.classList.contains("min-h-10")).toBe(true);
  expect(button.classList.contains("text-14")).toBe(true);
  expect(screen.queryByRole("textbox")).toBeNull();
});

it("shows the existing placeholder for an empty description and focuses the editor", () => {
  setup("");
  fireEvent.click(screen.getByRole("button", { name: placeholder }));
  const textarea = screen.getByRole<HTMLTextAreaElement>("textbox", { name: "description" });
  expect(textarea.value).toBe("");
  expect(textarea.placeholder).toBe(placeholder);
  expect(document.activeElement).toBe(textarea);
});

it("persists only the description with the workspace and project IDs, retaining whitespace and blank lines", async () => {
  const { rerender } = setup();
  const description = "  First line\n\nSecond line\n";
  edit(description);
  fireEvent.click(screen.getByRole("button", { name: "save" }));
  await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());
  expect(mocks.updateProject).toHaveBeenCalledExactlyOnceWith("workspace", "project-1", { description });
  rerender(
    <ProjectOverviewDescription project={{ ...project, description }} workspaceSlug="workspace" disabled={false} />
  );
  expect(screen.getByRole("button").textContent).toBe(description);
  expect(mocks.toast).not.toHaveBeenCalled();
});

it("allows clearing the description and persists the empty string", async () => {
  setup();
  edit("");
  fireEvent.click(screen.getByRole("button", { name: "save" }));
  await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());
  expect(mocks.updateProject).toHaveBeenCalledExactlyOnceWith("workspace", "project-1", { description: "" });
});

it("keeps the draft after an optimistic store update and rollback, reports the error, and permits retry", async () => {
  let rejectSave!: (reason: Error) => void;
  mocks.updateProject.mockReturnValueOnce(
    new Promise((_, reject) => {
      rejectSave = reject;
    })
  );
  const { rerender } = setup();
  const description = "Unsaved draft\n\nKeep this line";
  edit(description);
  fireEvent.click(screen.getByRole("button", { name: "save" }));
  rerender(
    <ProjectOverviewDescription project={{ ...project, description }} workspaceSlug="workspace" disabled={false} />
  );
  await act(async () => rejectSave(new Error("Network error")));
  rerender(<ProjectOverviewDescription project={project} workspaceSlug="workspace" disabled={false} />);
  expect(mocks.toast).toHaveBeenCalledExactlyOnceWith({
    type: "error",
    title: "something_went_wrong_please_try_again",
  });
  expect(screen.getByRole<HTMLTextAreaElement>("textbox").value).toBe(description);
  fireEvent.click(screen.getByRole("button", { name: "save" }));
  await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());
  expect(mocks.updateProject).toHaveBeenCalledTimes(2);
  expect(mocks.updateProject).toHaveBeenLastCalledWith("workspace", "project-1", { description });
});

it("cancels without saving and starts the next edit with the current project value", () => {
  const { rerender } = setup();
  edit("Discard this draft");
  fireEvent.click(screen.getByRole("button", { name: "cancel" }));
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(screen.getByRole("button").textContent).toBe(project.description);
  const description = "Updated by another member";
  rerender(
    <ProjectOverviewDescription project={{ ...project, description }} workspaceSlug="workspace" disabled={false} />
  );
  fireEvent.click(screen.getByRole("button"));
  expect(screen.getByRole<HTMLTextAreaElement>("textbox").value).toBe(description);
  expect(mocks.updateProject).not.toHaveBeenCalled();
});

it.each(["", "Read-only description"])("is read-only when disabled (description: %j)", (description) => {
  setup(description, true);
  const button = screen.getByRole<HTMLButtonElement>("button");
  expect(button.disabled).toBe(true);
  expect(button.textContent).toBe(description || placeholder);
  fireEvent.click(button);
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(mocks.updateProject).not.toHaveBeenCalled();
});

it("prevents saving when the caller disables an open editor", () => {
  const { rerender } = setup();
  edit("Cannot save after permissions change");
  const save = screen.getByRole("button", { name: "save" });
  rerender(<ProjectOverviewDescription project={project} workspaceSlug="workspace" disabled />);
  fireEvent.click(save);
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(screen.getByRole<HTMLButtonElement>("button").disabled).toBe(true);
  expect(mocks.updateProject).not.toHaveBeenCalled();
});

it("locks the editor and cancel button during saving and prevents duplicate submissions", async () => {
  let resolveSave!: () => void;
  mocks.updateProject.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      resolveSave = resolve;
    })
  );
  setup();
  const textarea = edit("Pending description");
  const save = screen.getByRole<HTMLButtonElement>("button", { name: "save" });
  fireEvent.click(save);
  expect(textarea.disabled).toBe(true);
  expect(screen.getByRole("button", { name: "saving" }).getAttribute("aria-disabled")).toBe("true");
  const cancel = screen.getByRole<HTMLButtonElement>("button", { name: "cancel" });
  expect(cancel.disabled).toBe(true);
  fireEvent.click(save);
  fireEvent.click(cancel);
  expect(mocks.updateProject).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("textbox")).toBe(textarea);
  await act(async () => resolveSave());
  expect(screen.queryByRole("textbox")).toBeNull();
});
