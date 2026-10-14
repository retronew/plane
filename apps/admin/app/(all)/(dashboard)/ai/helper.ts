/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TInstanceAIProtocol } from "@plane/types";

type TAIProtocolOption = {
  key: TInstanceAIProtocol;
  i18nLabel: string;
  defaultBaseUrl: string;
  /** Path the SDK appends to the base URL for a chat request, shown in the URL preview */
  chatPath: string;
  modelPlaceholder: string;
};

export const AI_PROTOCOLS: TAIProtocolOption[] = [
  {
    key: "openai",
    i18nLabel: "admin.ai.protocols.openai",
    defaultBaseUrl: "https://api.openai.com/v1",
    chatPath: "/chat/completions",
    modelPlaceholder: "gpt-4o-mini",
  },
  {
    key: "openai-responses",
    i18nLabel: "admin.ai.protocols.openai_responses",
    defaultBaseUrl: "https://api.openai.com/v1",
    chatPath: "/responses",
    modelPlaceholder: "gpt-5",
  },
  {
    key: "anthropic",
    i18nLabel: "admin.ai.protocols.anthropic",
    defaultBaseUrl: "https://api.anthropic.com",
    chatPath: "/v1/messages",
    modelPlaceholder: "claude-sonnet-4-5",
  },
  {
    key: "gemini",
    i18nLabel: "admin.ai.protocols.gemini",
    defaultBaseUrl: "https://generativelanguage.googleapis.com",
    chatPath: "/v1beta/models/{model}:streamGenerateContent",
    modelPlaceholder: "gemini-2.5-flash",
  },
];

export const getAIProtocol = (protocol: string | undefined): TAIProtocolOption =>
  AI_PROTOCOLS.find((p) => p.key === protocol) ?? AI_PROTOCOLS[0];

/**
 * Mirrors `normalize_base_url` in apps/api/plane/utils/llm.py: an empty value uses the official
 * endpoint and a trailing "#" keeps the URL as typed. OpenAI protocols append "/v1" to a bare host;
 * the Anthropic and Gemini SDKs add their version path themselves, so a trailing one is dropped.
 */
export const resolveAIBaseUrl = (protocol: TInstanceAIProtocol, baseUrl: string | undefined): string | undefined => {
  const option = getAIProtocol(protocol);
  let url = (baseUrl ?? "").trim();
  if (!url) return option.defaultBaseUrl;
  if (url.endsWith("#")) return url.slice(0, -1).replace(/\/+$/, "");
  url = url.replace(/\/+$/, "");
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return undefined;
  }
  if (protocol === "openai" || protocol === "openai-responses") {
    return parsed.pathname === "/" ? `${parsed.origin}/v1` : url;
  }
  const versionSuffix = protocol === "anthropic" ? /\/v1$/ : /\/v1(beta)?$/;
  return url.replace(versionSuffix, "");
};

/** Provider presets with a localized name under `admin.ai.provider_names.<key>` */
export const TRANSLATED_AI_PROVIDERS = new Set([
  "dashscope",
  "deepseek",
  "minimax",
  "moonshot",
  "moonshot-cn",
  "qiniu",
  "siliconflow",
  "volcengine",
  "zai",
  "zhipu",
]);
