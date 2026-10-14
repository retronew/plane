/** Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@plane/constants", () => ({ API_BASE_URL: "http://localhost" }));
vi.mock("@plane/services", () => ({ normalizeAPIRequestURL: (url: string) => url }));
import { AIService } from "./ai.service";

afterEach(() => {
  vi.unstubAllGlobals();
});
describe("AI request", () => {
  it("allows JSON negotiation for DRF while consuming SSE", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(
      async () => new Response('data: {"delta":"ok"}\n\ndata: {"done":true}\n\n')
    );
    vi.stubGlobal("fetch", fetch);
    expect(
      await new AIService().streamGptTask(
        "team",
        { context: { kind: "issue", title: "Title", document: "draft" } },
        vi.fn()
      )
    ).toBe("ok");
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({
      credentials: "include",
      headers: { Accept: "text/event-stream, application/json" },
    });
  });
});
