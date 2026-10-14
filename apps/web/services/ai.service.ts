/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// helpers
import { API_BASE_URL } from "@plane/constants";
import { normalizeAPIRequestURL } from "@plane/services";
import type { AI_EDITOR_TASKS } from "@plane/constants";
// services
import { APIService } from "@/services/api.service";
// types
// FIXME:
// import { IGptResponse } from "@plane/types";
// helpers

export type TTaskPayload = {
  casual_score?: number;
  formal_score?: number;
  task: AI_EDITOR_TASKS;
  text_input: string;
};

export class AIService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async createGptTask(workspaceSlug: string, data: { prompt: string; task: string }): Promise<any> {
    return this.post(`/api/workspaces/${workspaceSlug}/ai-assistant/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response;
      });
  }

  /**
   * Streams the AI response as server-sent events, calling `onDelta` with each text chunk.
   * Resolves with the full text; rejects with `{ status, data: { error } }` like `createGptTask`.
   */
  async streamGptTask(
    workspaceSlug: string,
    data: { prompt: string; task: string },
    onDelta: (delta: string) => void,
    signal?: AbortSignal
  ): Promise<string> {
    const url = normalizeAPIRequestURL(`${this.baseURL}/api/workspaces/${workspaceSlug}/ai-assistant/`, this.baseURL);
    const response = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({ ...data, stream: true }),
      signal,
    });

    if (!response.ok || !response.body) {
      const body = await response.json().catch(() => ({}));
      throw { status: response.status, data: body };
    }

    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    let text = "";
    for (;;) {
      // oxlint-disable-next-line no-await-in-loop -- stream chunks must be read in order
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";
      for (const event of events) {
        const line = event.split("\n").find((l) => l.startsWith("data: "));
        if (!line) continue;
        const payload = JSON.parse(line.slice("data: ".length)) as { delta?: string; error?: string; done?: boolean };
        if (payload.error) throw { status: 500, data: { error: payload.error } };
        if (payload.delta) {
          text += payload.delta;
          onDelta(payload.delta);
        }
      }
    }
    return text;
  }

  async performEditorTask(
    workspaceSlug: string,
    data: TTaskPayload
  ): Promise<{
    response: string;
  }> {
    return this.post(`/api/workspaces/${workspaceSlug}/rephrase-grammar/`, data)
      .then((res) => res?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}
