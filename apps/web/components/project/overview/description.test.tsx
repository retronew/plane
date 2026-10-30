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
vi.mock("@/hooks/store/use-workspace", () => ({
  useWorkspace: () => ({ getWorkspaceBySlug: () => ({ id: "workspace-1" }) }),
}));
vi.mock("@/components/editor/rich-text", () => ({
  RichTextEditor: ({
    editable,
    initialValue,
    value,
    onChange,
  }: {
    editable: boolean;
    initialValue: string;
    value?: string;
    onChange?: (json: object, html: string) => void;
  }) =>
    editable ? (
      <textarea
        aria-label="Rich description"
        defaultValue={initialValue}
        onChange={(event) => onChange?.({ type: "doc", content: [] }, event.target.value)}
      />
    ) : (
      <div data-testid="rich-description">{value ?? initialValue}</div>
    ),
}));
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

it("renders safe CommonMark with semantic headings, lists, code, quotes and links", () => {
  setup(
    "# Heading\n\nA **strong** paragraph with `code` and [Docs](https://example.com).\n\n- Item\n\n1. Ordered\n\n> Quote\n\n```ts\nconst ready = true;\n```\n\n<script>alert(1)</script>\n\n[Unsafe](javascript:alert%281%29)"
  );
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Heading");
  expect(screen.getAllByRole("list")).toHaveLength(2);
  expect(document.querySelector("strong")?.textContent).toBe("strong");
  expect(document.querySelector("blockquote")?.textContent).toContain("Quote");
  expect(document.querySelector("pre code")?.textContent).toContain("const ready = true;");
  expect(document.querySelector("script")).toBeNull();
  expect(screen.getByText("Unsafe").getAttribute("href")).toBe("");
  const link = screen.getByRole("link", { name: "Docs" });
  expect(link.getAttribute("href")).toBe("https://example.com");
  expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  expect(link.closest("button")).toBeNull();
  expect(link.closest('[role="button"]')).toBe(screen.getByRole("button", { name: "edit" }));
});

it("preserves paragraph soft breaks around inline Markdown", () => {
  setup("First line\n**Second** line\nThird `code` line");
  const paragraph = document.querySelector("p");
  expect(paragraph?.textContent).toBe("First line\nSecond line\nThird code line");
  expect(paragraph?.classList.contains("whitespace-pre-line")).toBe(true);
  expect(paragraph?.querySelector("strong")?.textContent).toBe("Second");
});

it.each(["\n", "\r\n"])("adds one line of spacing per extra blank line (%j)", (newline) => {
  setup(`One${newline.repeat(2)}Two${newline.repeat(3)}Three${newline.repeat(5)}Five`);
  const paragraphs = document.querySelectorAll("p");
  expect(paragraphs).toHaveLength(4);
  expect(paragraphs[1].style.marginTop).toBe("");
  expect(paragraphs[2].style.marginTop).toBe("calc(2.25rem)");
  expect(paragraphs[3].style.marginTop).toBe("calc(5.25rem)");
});

it("leaves fenced code, lists and quotes intact when they contain blank lines", () => {
  setup("```txt\nfirst\n\n\nlast\n```\n\n- first\n\n  continued\n\n- second\n\n> first\n>\n>\n> last");
  expect(document.querySelector("pre code")?.textContent).toBe("first\n\n\nlast\n");
  expect(screen.getAllByRole("listitem")).toHaveLength(2);
  expect(screen.getAllByRole("listitem")[0].querySelectorAll("p")).toHaveLength(2);
  expect(document.querySelectorAll("blockquote p")).toHaveLength(2);
  expect([...document.querySelectorAll("p")].every((paragraph) => paragraph.style.marginTop === "")).toBe(true);
});

it("keeps links usable without entering edit mode, including read-only descriptions", () => {
  const { rerender } = setup("[Docs](https://example.com)");
  const link = screen.getByRole("link");
  fireEvent.pointerUp(link, { button: 0 });
  fireEvent.click(link);
  expect(screen.queryByRole("textbox")).toBeNull();
  rerender(
    <ProjectOverviewDescription
      project={{ ...project, description: "[Docs](https://example.com)" }}
      workspaceSlug="workspace"
      disabled
    />
  );
  const readOnlyLink = screen.getByRole("link");
  expect(readOnlyLink.getAttribute("href")).toBe("https://example.com");
  expect(readOnlyLink.closest("button")).toBeNull();
  expect(screen.getByRole("button").getAttribute("aria-disabled")).toBe("true");
  fireEvent.click(readOnlyLink);
  expect(screen.queryByRole("textbox")).toBeNull();
});

it.each(["Enter", " "])("opens the editor with %j from the non-native button container", (key) => {
  setup();
  const button = screen.getByRole("button", { name: "edit" });
  expect(button.tagName).not.toBe("BUTTON");
  expect(button.tabIndex).toBe(0);
  expect(button.getAttribute("aria-disabled")).toBe("false");
  button.focus();
  fireEvent.keyDown(button, { key });
  expect(screen.getByRole("textbox")).toBe(document.activeElement);
});

it("sizes the real TextArea on initial multiline mount, growth and shrink without a flex parent", () => {
  const scrollHeight = vi.spyOn(HTMLTextAreaElement.prototype, "scrollHeight", "get").mockImplementation(function (
    this: HTMLTextAreaElement
  ) {
    return Math.max(40, this.value.split("\n").length * 24);
  });
  setup("One\nTwo\nThree");
  fireEvent.click(screen.getByRole("button"));
  const textarea = screen.getByRole<HTMLTextAreaElement>("textbox");
  expect(textarea.style.height).toBe("74px");
  expect(textarea.parentElement?.classList.contains("flex")).toBe(false);
  fireEvent.change(textarea, { target: { value: "One\nTwo\nThree\nFour\nFive" } });
  expect(textarea.style.height).toBe("122px");
  fireEvent.change(textarea, { target: { value: "One" } });
  expect(textarea.style.height).toBe("42px");
  scrollHeight.mockRestore();
});

it("opens and focuses the editor directly from the empty placeholder without confirmation buttons", () => {
  setup("");
  fireEvent.click(screen.getByRole("button", { name: "edit" }));
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
  expect(mocks.updateProject).toHaveBeenCalledExactlyOnceWith("workspace", "project-1", {
    description,
    description_html: null,
    description_text: null,
  });
  expect(mocks.refreshActivities).toHaveBeenCalledOnce();
  rerender(
    <ProjectOverviewDescription project={{ ...project, description }} workspaceSlug="workspace" disabled={false} />
  );
  expect(screen.getByText("First line")).toBeDefined();
  expect(screen.getByText("Second line")).toBeDefined();
  expect(mocks.toast).not.toHaveBeenCalled();
});

it("allows clearing the description and persists the empty string on blur", async () => {
  setup();
  fireEvent.blur(edit(""));
  await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());
  expect(mocks.updateProject).toHaveBeenCalledExactlyOnceWith("workspace", "project-1", {
    description: "",
    description_html: null,
    description_text: null,
  });
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
    expect(mocks.updateProject).toHaveBeenLastCalledWith("workspace", "project-1", {
      description,
      description_html: null,
      description_text: null,
    });
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
  const container = screen.getByRole("button");
  expect(container.tagName).not.toBe("BUTTON");
  expect(container.getAttribute("aria-disabled")).toBe("true");
  expect(container.tabIndex).toBe(-1);
  const body = screen.getByText(description || placeholder);
  fireEvent.click(body);
  fireEvent.keyDown(container, { key: "Enter" });
  fireEvent.keyDown(container, { key: " " });
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(mocks.updateProject).not.toHaveBeenCalled();
});

it("prevents saving when permissions are withdrawn from an open editor", () => {
  const { rerender } = setup();
  const textarea = edit("Cannot save after permissions change");
  rerender(<ProjectOverviewDescription project={project} workspaceSlug="workspace" disabled />);
  fireEvent.blur(textarea);
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(screen.getByRole("button").getAttribute("aria-disabled")).toBe("true");
  expect(screen.getByRole("button").tagName).not.toBe("BUTTON");
  expect(mocks.updateProject).not.toHaveBeenCalled();
});

it("saves rich descriptions explicitly with HTML, JSON and derived Markdown", async () => {
  render(
    <ProjectOverviewDescription
      project={{ ...project, description_html: "<p>Original rich description</p>" }}
      workspaceSlug="workspace"
      disabled={false}
    />
  );
  expect(screen.getByTestId("rich-description").textContent).toBe("<p>Original rich description</p>");
  fireEvent.click(screen.getByRole("button", { name: "edit" }));
  const editor = screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Rich description" });
  expect(editor.value).toBe("<p>Original rich description</p>");
  fireEvent.change(editor, { target: { value: "<p>Updated <strong>description</strong></p>" } });
  fireEvent.blur(editor);
  expect(mocks.updateProject).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "save" }));
  await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());
  expect(mocks.updateProject).toHaveBeenCalledExactlyOnceWith("workspace", "project-1", {
    description: "Updated **description**\n",
    description_html: "<p>Updated <strong>description</strong></p>",
    description_text: { type: "doc", content: [] },
  });
  expect(mocks.refreshActivities).toHaveBeenCalledOnce();
});

it("discards a rich draft on cancel and closes unchanged rich descriptions without saving", () => {
  render(
    <ProjectOverviewDescription
      project={{ ...project, description_html: "<p>Original rich description</p>" }}
      workspaceSlug="workspace"
      disabled={false}
    />
  );
  fireEvent.click(screen.getByRole("button", { name: "edit" }));
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "<p>Discard this draft</p>" } });
  fireEvent.click(screen.getByRole("button", { name: "cancel" }));
  expect(screen.queryByRole("textbox")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "edit" }));
  expect(screen.getByRole<HTMLTextAreaElement>("textbox").value).toBe("<p>Original rich description</p>");
  fireEvent.click(screen.getByRole("button", { name: "save" }));
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(mocks.updateProject).not.toHaveBeenCalled();
  expect(mocks.refreshActivities).not.toHaveBeenCalled();
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
    description_html: null,
    description_text: null,
  });
  expect(screen.getByRole("textbox")).toBe(textarea);
  await act(async () => resolveSave());
  expect(screen.queryByRole("textbox")).toBeNull();
});
