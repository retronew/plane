/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { IProject } from "@plane/types";
import { ProjectOverviewDescription } from "./description";

const mocks = vi.hoisted(() => ({ updateProject: vi.fn(), toast: vi.fn(), refreshActivities: vi.fn() }));

vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/store/use-project", () => ({ useProject: () => ({ updateProject: mocks.updateProject }) }));
vi.mock("@plane/blocks/toast", () => ({ setToast: mocks.toast }));
vi.mock("./use-refresh-activities", () => ({ useRefreshProjectActivities: () => mocks.refreshActivities }));

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
  expect(button.classList.contains("items-start")).toBe(true);
  expect(button.classList.contains("leading-6")).toBe(true);
  expect(button.classList.contains("p-0")).toBe(true);
  expect(screen.queryByRole("textbox")).toBeNull();
});

it("opens and focuses the editor directly from the empty placeholder without confirmation buttons", () => {
  setup("");
  fireEvent.click(screen.getByRole("button", { name: placeholder }));
  const textarea = screen.getByRole<HTMLTextAreaElement>("textbox", { name: "description" });
  expect(textarea.value).toBe("");
  expect(textarea.placeholder).toBe(placeholder);
  expect(document.activeElement).toBe(textarea);
  expect(screen.queryByRole("button")).toBeNull();
  expect(textarea.rows).toBe(1);
  expect(textarea.parentElement?.className).toContain("leading-6");
  expect(mocks.updateProject).not.toHaveBeenCalled();
});

it.each(["", project.description ?? ""])(
  "closes an unchanged description on blur without saving (%j)",
  (description) => {
    setup(description);
    const textarea = edit(description);
    fireEvent.change(textarea, { target: { value: "Temporary draft" } });
    fireEvent.change(textarea, { target: { value: description } });
    fireEvent.blur(textarea);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(mocks.updateProject).not.toHaveBeenCalled();
    expect(mocks.refreshActivities).not.toHaveBeenCalled();
  }
);

it("retains Enter as a newline and saves whitespace and blank lines only on blur", async () => {
  const { rerender } = setup();
  const textarea = edit("  First line");
  expect(fireEvent.keyDown(textarea, { key: "Enter", code: "Enter" })).toBe(true);
  const description = "  First line\n\nSecond line\n";
  fireEvent.change(textarea, { target: { value: description } });
  expect(textarea.value).toBe(description);
  expect(screen.getByRole("textbox")).toBe(textarea);
  expect(mocks.updateProject).not.toHaveBeenCalled();
  fireEvent.blur(textarea);
  await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());
  expect(mocks.updateProject).toHaveBeenCalledExactlyOnceWith("workspace", "project-1", { description });
  expect(mocks.refreshActivities).toHaveBeenCalledOnce();
  rerender(
    <ProjectOverviewDescription project={{ ...project, description }} workspaceSlug="workspace" disabled={false} />
  );
  expect(screen.getByRole("button").textContent).toBe(description);
  expect(mocks.toast).not.toHaveBeenCalled();
});

it("allows clearing the description and persists the empty string on blur", async () => {
  setup();
  fireEvent.blur(edit(""));
  await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());
  expect(mocks.updateProject).toHaveBeenCalledExactlyOnceWith("workspace", "project-1", { description: "" });
});

it.each([false, true])(
  "keeps a failed draft and retries on focus and blur after an optimistic update (rollback: %j)",
  async (rollback) => {
    let rejectSave!: (reason: Error) => void;
    mocks.updateProject.mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectSave = reject;
      })
    );
    const { rerender } = setup();
    const description = "Unsaved draft\n\nKeep this line";
    const textarea = edit(description);
    fireEvent.blur(textarea);
    rerender(
      <ProjectOverviewDescription project={{ ...project, description }} workspaceSlug="workspace" disabled={false} />
    );
    await act(async () => rejectSave(new Error("Network error")));
    if (rollback) {
      rerender(<ProjectOverviewDescription project={project} workspaceSlug="workspace" disabled={false} />);
    }
    expect(mocks.toast).toHaveBeenCalledExactlyOnceWith({
      type: "error",
      title: "something_went_wrong_please_try_again",
    });
    expect(mocks.refreshActivities).not.toHaveBeenCalled();
    expect(screen.getByRole<HTMLTextAreaElement>("textbox").value).toBe(description);
    expect(textarea.disabled).toBe(false);
    fireEvent.focus(textarea);
    fireEvent.blur(textarea);
    await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());
    expect(mocks.updateProject).toHaveBeenCalledTimes(2);
    expect(mocks.updateProject).toHaveBeenLastCalledWith("workspace", "project-1", { description });
    expect(mocks.refreshActivities).toHaveBeenCalledOnce();
  }
);

it("starts a new edit with the current project value after saving", async () => {
  const { rerender } = setup();
  fireEvent.blur(edit("Saved description"));
  await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());
  const description = "Updated by another member";
  rerender(
    <ProjectOverviewDescription project={{ ...project, description }} workspaceSlug="workspace" disabled={false} />
  );
  fireEvent.click(screen.getByRole("button"));
  const textarea = screen.getByRole<HTMLTextAreaElement>("textbox");
  expect(textarea.value).toBe(description);
  fireEvent.blur(textarea);
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(mocks.updateProject).toHaveBeenCalledTimes(1);
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

it("prevents saving when permissions are withdrawn from an open editor", () => {
  const { rerender } = setup();
  const textarea = edit("Cannot save after permissions change");
  rerender(<ProjectOverviewDescription project={project} workspaceSlug="workspace" disabled />);
  fireEvent.blur(textarea);
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(screen.getByRole<HTMLButtonElement>("button").disabled).toBe(true);
  expect(mocks.updateProject).not.toHaveBeenCalled();
});

it("prevents saving without a workspace", () => {
  render(<ProjectOverviewDescription project={project} workspaceSlug="" disabled={false} />);
  fireEvent.blur(edit("Draft without a workspace"));
  expect(mocks.updateProject).not.toHaveBeenCalled();
});

it("locks the editor during saving and prevents duplicate blur submissions synchronously", async () => {
  let resolveSave!: () => void;
  mocks.updateProject.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      resolveSave = resolve;
    })
  );
  setup();
  const textarea = edit("Pending description");
  act(() => {
    fireEvent.blur(textarea);
    fireEvent.blur(textarea);
  });
  expect(textarea.disabled).toBe(true);
  fireEvent.blur(textarea);
  expect(mocks.updateProject).toHaveBeenCalledExactlyOnceWith("workspace", "project-1", {
    description: "Pending description",
  });
  expect(screen.getByRole("textbox")).toBe(textarea);
  await act(async () => resolveSave());
  expect(screen.queryByRole("textbox")).toBeNull();
});
