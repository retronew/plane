# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""
LLM access for Plane, built on any-llm (https://github.com/mozilla-ai/any-llm).

The instance stores a *protocol* (the wire format) and a base URL. Every provider preset
any-llm knows about maps onto one of these protocols, so third-party and self-hosted services
work by pointing a protocol at their base URL.
"""

# Python imports
import os
from dataclasses import dataclass
from functools import lru_cache
from typing import Iterator, List
from urllib.parse import urlsplit, urlunsplit

# Third party imports
import any_llm
from any_llm import AnyLLM, AnyLLMError

# Module imports
from plane.license.utils.instance_value import get_configuration_value

REQUEST_TIMEOUT = 60

# protocol -> (any-llm provider used for the call, default base URL)
PROTOCOLS = {
    "openai": ("openai", "https://api.openai.com/v1"),
    "openai-responses": ("openai", "https://api.openai.com/v1"),
    "anthropic": ("anthropic", "https://api.anthropic.com"),
    "gemini": ("gemini", "https://generativelanguage.googleapis.com"),
}

# OpenAI-compatible providers whose any-llm class needs an optional package we don't install,
# or doesn't declare a base URL. Calls go through the OpenAI protocol instead.
OPENAI_COMPATIBLE_FALLBACKS = {
    "cerebras": "https://api.cerebras.ai/v1",
    "groq": "https://api.groq.com/openai/v1",
    "lmstudio": "http://localhost:1234/v1",
    "mistral": "https://api.mistral.ai/v1",
    "ollama": "http://localhost:11434/v1",
    # Serves /chat/completions at the root, so keep the URL as is
    "perplexity": "https://api.perplexity.ai#",
    "together": "https://api.together.xyz/v1",
    "xai": "https://api.x.ai/v1",
}

# OpenAI-compatible services any-llm doesn't ship a provider for
EXTRA_PRESETS = [
    {"key": "siliconflow", "label": "SiliconFlow", "base_url": "https://api.siliconflow.cn/v1"},
    {"key": "volcengine", "label": "Volcengine Ark", "base_url": "https://ark.cn-beijing.volces.com/api/v3"},
    {"key": "zhipu", "label": "Zhipu AI (BigModel)", "base_url": "https://open.bigmodel.cn/api/paas/v4"},
    {"key": "moonshot-cn", "label": "Moonshot AI (Kimi, China)", "base_url": "https://api.moonshot.cn/v1"},
]

# Providers that need cloud credentials (not just an API key) or aren't chat services.
EXCLUDED_PROVIDERS = {
    "azure",
    "azureanthropic",
    "azureopenai",
    "bedrock",
    "databricks",
    "sagemaker",
    "vertexai",
    "vertexaianthropic",
    "voyage",
    "watsonx",
    "huggingface",
    "cohere",
    "otari",
    "mzai",
}

PROVIDER_LABELS = {
    "anthropic": "Anthropic",
    "dashscope": "Alibaba Cloud Model Studio (DashScope)",
    "deepinfra": "DeepInfra",
    "deepseek": "DeepSeek",
    "gemini": "Google Gemini",
    "github": "GitHub Models",
    "lmstudio": "LM Studio",
    "llamacpp": "llama.cpp",
    "minimax": "MiniMax",
    "moonshot": "Moonshot AI (Kimi)",
    "openai": "OpenAI",
    "openrouter": "OpenRouter",
    "qiniu": "Qiniu",
    "sambanova": "SambaNova",
    "vllm": "vLLM",
    "xai": "xAI",
    "zai": "Z.ai (GLM)",
}


class LLMError(Exception):
    """Raised when the provider cannot be reached or returns an error."""


@dataclass
class LLMConfig:
    protocol: str
    base_url: str
    api_key: str
    model: str = ""


def normalize_protocol(protocol: str | None) -> str:
    protocol = (protocol or "openai").strip().lower()
    if protocol not in PROTOCOLS:
        raise LLMError(f"Unsupported protocol: {protocol}")
    return protocol


def normalize_base_url(protocol: str, base_url: str | None) -> str:
    """
    Resolve the base URL handed to the provider SDK.

    - Empty: the provider's official endpoint.
    - Ending with "#": used exactly as typed, without the "#".
    - OpenAI protocols: a bare host gets "/v1" appended; a URL with a path is used as is.
    - Anthropic / Gemini: their SDKs add the version path themselves, so a trailing
      "/v1" or "/v1beta" is dropped.
    """
    default_url = PROTOCOLS[protocol][1]
    url = (base_url or "").strip()
    if not url:
        return default_url
    if url.endswith("#"):
        return url[:-1].rstrip("/")

    url = url.rstrip("/")
    parts = urlsplit(url)
    if not parts.scheme or not parts.netloc:
        raise LLMError(f"Invalid base URL: {base_url}")

    if protocol in ("openai", "openai-responses"):
        if not parts.path:
            url = urlunsplit((parts.scheme, parts.netloc, "/v1", parts.query, ""))
        return url

    version_suffix = "/v1" if protocol == "anthropic" else ("/v1beta", "/v1")
    if url.endswith(version_suffix):
        url = url.rsplit("/", 1)[0]
    return url


def _call_kwargs(config: LLMConfig) -> dict:
    return {
        "provider": PROTOCOLS[config.protocol][0],
        "api_key": config.api_key,
        "api_base": normalize_base_url(config.protocol, config.base_url),
    }


def _error_message(error: Exception) -> str:
    message = str(error) or error.__class__.__name__
    return message[:500]


def list_models(config: LLMConfig) -> List[str]:
    kwargs = _call_kwargs(config)
    try:
        models = any_llm.list_models(**kwargs, client_args={"timeout": REQUEST_TIMEOUT})
    except (AnyLLMError, Exception) as e:
        raise LLMError(_error_message(e)) from e
    ids = {getattr(model, "id", "") or "" for model in models}
    return sorted(model.removeprefix("models/") for model in ids if model)


def stream_chat(config: LLMConfig, prompt: str, max_tokens: int | None = None) -> Iterator[str]:
    """Yield the model's reply as text deltas."""
    if not config.model:
        raise LLMError("Model is required")
    kwargs = _call_kwargs(config)

    upstream = None
    try:
        if config.protocol == "openai-responses":
            events = any_llm.responses(
                model=config.model,
                input_data=prompt,
                stream=True,
                max_output_tokens=max_tokens,
                timeout=REQUEST_TIMEOUT,
                **kwargs,
            )
            upstream = events
            for event in events:
                if getattr(event, "type", "") in ("response.failed", "response.incomplete", "error"):
                    raise LLMError("Model response failed or was incomplete")
                if getattr(event, "type", "") == "response.output_text.delta":
                    yield event.delta
            return

        chunks = any_llm.completion(
            model=config.model,
            messages=[{"role": "user", "content": prompt}],
            stream=True,
            max_tokens=max_tokens or (4096 if config.protocol == "anthropic" else None),
            reasoning_effort=None,
            timeout=REQUEST_TIMEOUT,
            **kwargs,
        )
        upstream = chunks
        for chunk in chunks:
            for choice in chunk.choices or []:
                if getattr(choice, "finish_reason", None) in ("length", "content_filter"):
                    raise LLMError("Model response was incomplete")
                delta = choice.delta.content if choice.delta else None
                if delta:
                    yield delta
    except LLMError:
        raise
    except Exception as e:
        raise LLMError(_error_message(e)) from e

    finally:
        close = getattr(upstream, "close", None)
        if close:
            close()


def chat(config: LLMConfig, prompt: str, max_tokens: int | None = None) -> str:
    return "".join(stream_chat(config, prompt, max_tokens=max_tokens))


def _provider_protocol(provider_class) -> str | None:
    bases = {cls.__name__ for cls in provider_class.__mro__}
    if "BaseAnthropicProvider" in bases:
        return "anthropic"
    if "GoogleProvider" in bases:
        return "gemini"
    if "BaseOpenAIProvider" in bases:
        return "openai"
    return None


@lru_cache(maxsize=1)
def get_provider_presets() -> List[dict]:
    """Provider presets from any-llm's registry: label, protocol and base URL to prefill."""
    presets = []
    for metadata in AnyLLM.get_all_provider_metadata():
        name = metadata.name
        if name in EXCLUDED_PROVIDERS or not metadata.completion:
            continue
        provider_class = AnyLLM.get_provider_class(name)

        if name in OPENAI_COMPATIBLE_FALLBACKS:
            protocol, base_url = "openai", OPENAI_COMPATIBLE_FALLBACKS[name]
        else:
            if provider_class.MISSING_PACKAGES_ERROR is not None:
                continue
            protocol = _provider_protocol(provider_class)
            base_url = provider_class.API_BASE or (PROTOCOLS[protocol][1] if protocol in PROTOCOLS else None)
            if not protocol or not base_url:
                continue

        presets.append(
            {
                "key": name,
                "label": PROVIDER_LABELS.get(name, name.capitalize()),
                "protocol": protocol,
                "base_url": base_url if base_url.endswith("#") else base_url.rstrip("/"),
                "doc_url": metadata.doc_url,
                "list_models": bool(metadata.list_models),
            }
        )
    for extra in EXTRA_PRESETS:
        presets.append({**extra, "protocol": "openai", "doc_url": None, "list_models": True})
    return sorted(presets, key=lambda preset: preset["label"].lower())


def get_llm_config() -> LLMConfig | None:
    """The instance's saved LLM configuration, or None when AI is not configured."""
    api_key, protocol, base_url, model = get_configuration_value(
        [
            {"key": "LLM_API_KEY", "default": os.environ.get("LLM_API_KEY", None)},
            {"key": "LLM_PROVIDER", "default": os.environ.get("LLM_PROVIDER", "openai")},
            {"key": "LLM_BASE_URL", "default": os.environ.get("LLM_BASE_URL", "")},
            {"key": "LLM_MODEL", "default": os.environ.get("LLM_MODEL", None)},
        ]
    )
    if not api_key or not model:
        return None
    try:
        protocol = normalize_protocol(protocol)
    except LLMError:
        return None
    return LLMConfig(protocol=protocol, base_url=base_url or "", api_key=api_key, model=model)
