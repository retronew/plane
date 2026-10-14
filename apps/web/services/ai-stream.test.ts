/** Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, it, vi } from "vitest";
import { readAIStream } from "./ai-stream";
const stream = (chunks: string[]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      chunks.forEach((value) => controller.enqueue(new TextEncoder().encode(value)));
      controller.close();
    },
  });
describe("AI stream", () => {
  it("reads fragmented CRLF frames and stops on completion", async () => {
    const onDelta = vi.fn();
    expect(
      await readAIStream(
        stream(['data: {"delta":"你"}\r', '\n\r\ndata: {"delta":"好"}\n\n', 'data: {"done":true}\n\n']),
        onDelta
      )
    ).toBe("你好");
    expect(onDelta.mock.calls).toEqual([["你"], ["好"]]);
  });
  it("rejects truncated output instead of allowing it to be applied", async () => {
    await expect(readAIStream(stream(['data: {"delta":"partial"}\n\n']), vi.fn())).rejects.toThrow("interrupted");
  });
  it.each(['data: {"error":"upstream secret"}\n\n', 'data: {"delta":42}\n\n', "data: not-json\n\n"])(
    "rejects invalid/error frames",
    async (frame) => {
      await expect(readAIStream(stream([frame]), vi.fn())).rejects.toThrow();
    }
  );
  it("cancels the reader after a terminal event", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new TextEncoder().encode('data: {"done":true}\n\n'));
      },
      cancel,
    });
    await readAIStream(body, vi.fn());
    expect(cancel).toHaveBeenCalled();
  });
});
