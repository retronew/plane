/** Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only */

/** A closed connection is only successful after the server's explicit completion event. */
export async function readAIStream(
  body: ReadableStream<Uint8Array>,
  onDelta: (delta: string) => void
): Promise<string> {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let text = "";
  try {
    for (;;) {
      // oxlint-disable-next-line no-await-in-loop -- stream frames are ordered
      const { value, done } = await reader.read();
      if (done) throw new Error("AI response interrupted before completion");
      buffer += value;
      // Accept LF and CRLF, including CRLF split between network chunks.
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() ?? "";
      for (const event of events) {
        const data = event
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n");
        if (!data) continue;
        const payload: unknown = JSON.parse(data);
        if (!payload || typeof payload !== "object") throw new Error("Invalid AI event");
        if ("error" in payload) throw new Error("AI generation failed");
        if ("delta" in payload) {
          if (typeof payload.delta !== "string") throw new Error("Invalid AI delta");
          text += payload.delta;
          onDelta(payload.delta);
        }
        if ("done" in payload && payload.done === true) return text;
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
