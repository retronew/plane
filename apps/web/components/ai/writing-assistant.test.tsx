/** Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StrictMode } from "react";
import { WritingAssistant } from "./writing-assistant";
import { textToHtml } from "./writing";
const stream = vi.hoisted(() => vi.fn());
vi.mock("@/services/ai.service", () => ({
  AIService: class {
    streamGptTask = stream;
  },
}));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
const context = { kind: "issue" as const, title: "Login", document: "<p>Existing description</p>" };
const renderAssistant = (apply = vi.fn(() => true)) => {
  const undo = vi.fn();
  const result = render(
    <StrictMode>
      <WritingAssistant
        workspaceSlug="test"
        getContext={() => context}
        onApply={apply}
        onClose={vi.fn()}
        onUndo={undo}
      />
    </StrictMode>
  );
  return { ...result, apply, undo };
};
describe("One-click AI optimization", () => {
  beforeEach(() => {
    stream.mockReset();
  });
  it("automatically sends only context once and waits for explicit adoption", async () => {
    stream.mockImplementation(async (_slug, _data, delta) => {
      delta("<script>alert(1)</script>");
      return "<script>alert(1)</script>";
    });
    const { apply, undo } = renderAssistant();
    await screen.findByText("web.ai_writing_replace");
    expect(stream).toHaveBeenCalledOnce();
    expect(stream.mock.calls[0][1]).toEqual({ context });
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(apply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("web.ai_writing_replace"));
    expect(apply).toHaveBeenCalledWith("<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>", "replace", context);
    fireEvent.click(screen.getByText("web.ai_writing_undo"));
    expect(undo).toHaveBeenCalledWith(context);
  });
  it("stops and ignores late output, then permits retry", async () => {
    let emit: (value: string) => void = () => {};
    stream.mockImplementation((_slug, _data, delta) => {
      emit = delta;
      return new Promise(() => {});
    });
    const { unmount } = renderAssistant();
    await screen.findByText("web.ai_writing_stop");
    const signal = stream.mock.calls[0][3] as AbortSignal;
    fireEvent.click(screen.getByText("web.ai_writing_stop"));
    expect(signal.aborted).toBe(true);
    act(() => emit("late response"));
    expect(screen.queryByText("late response")).toBeNull();
    expect(screen.queryByText("web.ai_writing_replace")).toBeNull();
    fireEvent.click(screen.getByText("web.ai_writing_retry"));
    expect(stream).toHaveBeenCalledTimes(2);
    unmount();
    expect(stream.mock.calls[1][3].aborted).toBe(true);
  });
  it("does not offer partial results from a failed stream", async () => {
    stream.mockImplementation(async (_slug, _data, delta) => {
      delta("partial");
      throw new Error("disconnect");
    });
    renderAssistant();
    await screen.findByRole("alert");
    expect(screen.queryByText("web.ai_writing_replace")).toBeNull();
  });
  it("rejects stale source content instead of appending", async () => {
    stream.mockImplementation(async (_slug, _data, delta) => {
      delta("result");
      return "result";
    });
    const apply = vi.fn(() => false);
    renderAssistant(apply);
    await screen.findByText("web.ai_writing_append");
    fireEvent.click(screen.getByText("web.ai_writing_append"));
    expect(apply).toHaveBeenCalledWith("<p>result</p>", "append", context);
    expect(screen.getByRole("alert").textContent).toBe("web.ai_writing_changed");
  });
  it("explains a quota failure", async () => {
    stream.mockRejectedValue({ status: 429 });
    renderAssistant();
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("web.ai_writing_quota"));
  });
  it("recovers from a context failure and allows retry", async () => {
    const getContext = vi
      .fn(() => context)
      .mockImplementationOnce(() => {
        throw new Error("editor unavailable");
      });
    stream.mockResolvedValue("result");
    render(
      <WritingAssistant
        workspaceSlug="test"
        getContext={getContext}
        onApply={vi.fn(() => true)}
        onClose={vi.fn()}
        onUndo={vi.fn()}
      />
    );
    await screen.findByRole("alert");
    expect(screen.getByRole("alert").textContent).toBe("web.ai_writing_failed");
    expect(stream).not.toHaveBeenCalled();
    expect(screen.queryByText("web.ai_writing_stop")).toBeNull();
    fireEvent.click(screen.getByText("web.ai_writing_retry"));
    await screen.findByText("web.ai_writing_replace");
    expect(stream).toHaveBeenCalledOnce();
  });
  it("preserves paragraphs while escaping model HTML", () => {
    expect(textToHtml('a & b\nline\n\n<img src="x">')).toBe(
      "<p>a &amp; b<br/>line</p><p>&lt;img src=&quot;x&quot;&gt;</p>"
    );
  });
});
