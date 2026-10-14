/** Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, describe, expect, it, vi } from "vitest";
import { copyPageContent, pageHTMLToText } from "./copy-content";

afterEach(() => vi.unstubAllGlobals());
describe("Page copy formats", () => {
  it("keeps paragraph, line and table boundaries in plain text", () => {
    expect(
      pageHTMLToText("<h1>Title</h1><p>A &amp; B<br>Next</p><table><tr><td>One</td><td>Two</td></tr></table>")
    ).toBe("Title\nA & B\nNext\nOne\tTwo");
  });
  it.each(["text", "markdown", "html"] as const)("copies %s as the requested format", async (format) => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    await copyPageContent(
      { getDocument: () => ({ html: "<p>Hello</p>", json: null, binary: null }), getMarkDown: () => "**Hello**" },
      format
    );
    expect(writeText).toHaveBeenCalledWith(
      format === "text" ? "Hello" : format === "html" ? "<p>Hello</p>" : "**Hello**"
    );
  });
  it("propagates clipboard errors so the UI cannot report false success", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
    await expect(
      copyPageContent(
        { getDocument: () => ({ html: "", json: null, binary: null }), getMarkDown: () => "" },
        "markdown"
      )
    ).rejects.toThrow("denied");
  });
});
