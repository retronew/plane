/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export type TInstanceAIConfigurationKeys = "LLM_API_KEY" | "LLM_MODEL" | "LLM_PROVIDER" | "LLM_BASE_URL";

export type TInstanceAIProtocol = "openai" | "openai-responses" | "anthropic" | "gemini";

export type TInstanceAIConnectionPayload = {
  protocol: TInstanceAIProtocol;
  base_url: string;
  api_key: string;
  model?: string;
};

export type TInstanceAIModelsResponse = {
  base_url: string;
  models: string[];
};

export type TInstanceAITestResponse = {
  model: string;
  reply: string;
  latency_ms: number;
};

export type TInstanceAIProviderPreset = {
  key: string;
  label: string;
  protocol: TInstanceAIProtocol;
  base_url: string;
  doc_url: string | null;
  list_models: boolean;
};
