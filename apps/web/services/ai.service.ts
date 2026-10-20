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
import type { WritingContext } from "@/components/ai/writing";
import { readAIStream } from "./ai-stream";
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

  async suggestWorkspaceSlug(name: string): Promise<{ slug: string }> {
    return this.post("/api/ai/workspace-slug/", { name })
      .then((response) => response.data)
      .catch((error) => {
        throw error?.response;
      });
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
    data: { context: WritingContext },
    onDelta: (delta: string) => void,
    signal?: AbortSignal
  ): Promise<string> {
    const url = normalizeAPIRequestURL(`${this.baseURL}/api/workspaces/${workspaceSlug}/ai-assistant/`, this.baseURL);
    const response = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream, application/json" },
      body: JSON.stringify({ ...data, stream: true }),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(90000)]) : AbortSignal.timeout(90000),
    });

    if (!response.ok || !response.body) {
      const body = await response.json().catch(() => ({}));
      throw { status: response.status, data: body };
    }

    return readAIStream(response.body, onDelta);
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
