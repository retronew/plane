# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from types import SimpleNamespace
from unittest.mock import patch

import pytest

from plane.utils.llm import (
    LLMConfig,
    LLMError,
    chat,
    get_provider_presets,
    list_models,
    normalize_base_url,
    normalize_protocol,
    stream_chat,
)


def _chunk(text):
    return SimpleNamespace(choices=[SimpleNamespace(delta=SimpleNamespace(content=text))])


@pytest.mark.unit
class TestNormalizeBaseUrl:
    @pytest.mark.parametrize(
        "protocol,base_url,expected",
        [
            ("openai", "", "https://api.openai.com/v1"),
            ("openai", "https://api.deepseek.com", "https://api.deepseek.com/v1"),
            ("openai", "https://api.deepseek.com/", "https://api.deepseek.com/v1"),
            ("openai", "https://ark.cn-beijing.volces.com/api/v3", "https://ark.cn-beijing.volces.com/api/v3"),
            ("openai", "http://localhost:11434/v1/", "http://localhost:11434/v1"),
            ("openai", "https://api.perplexity.ai#", "https://api.perplexity.ai"),
            ("openai-responses", "https://relay.example.com", "https://relay.example.com/v1"),
            ("anthropic", "", "https://api.anthropic.com"),
            ("anthropic", "https://relay.example.com/v1/", "https://relay.example.com"),
            ("anthropic", "https://relay.example.com/claude", "https://relay.example.com/claude"),
            ("gemini", "", "https://generativelanguage.googleapis.com"),
            ("gemini", "https://relay.example.com/v1beta", "https://relay.example.com"),
        ],
    )
    def test_normalize(self, protocol, base_url, expected):
        assert normalize_base_url(protocol, base_url) == expected

    def test_invalid_url(self):
        with pytest.raises(LLMError):
            normalize_base_url("openai", "not-a-url")

    def test_protocol(self):
        assert normalize_protocol(None) == "openai"
        assert normalize_protocol(" Anthropic ") == "anthropic"
        with pytest.raises(LLMError):
            normalize_protocol("unknown")


@pytest.mark.unit
class TestListModels:
    @patch("plane.utils.llm.any_llm.list_models")
    def test_sorted_and_deduplicated(self, mock_list):
        mock_list.return_value = [
            SimpleNamespace(id="gpt-4o"),
            SimpleNamespace(id="models/gemini-2.5-flash"),
            SimpleNamespace(id="gpt-4o"),
        ]
        assert list_models(LLMConfig("openai", "https://api.deepseek.com", "sk")) == ["gemini-2.5-flash", "gpt-4o"]
        kwargs = mock_list.call_args.kwargs
        assert kwargs["provider"] == "openai"
        assert kwargs["api_base"] == "https://api.deepseek.com/v1"
        assert kwargs["api_key"] == "sk"

    @patch("plane.utils.llm.any_llm.list_models", side_effect=RuntimeError("Incorrect API key"))
    def test_error(self, _):
        with pytest.raises(LLMError, match="Incorrect API key"):
            list_models(LLMConfig("openai", "", "bad"))


@pytest.mark.unit
class TestChat:
    @patch("plane.utils.llm.any_llm.completion")
    def test_stream_openai(self, mock_completion):
        mock_completion.return_value = iter([_chunk("po"), _chunk(None), _chunk("ng")])
        assert list(stream_chat(LLMConfig("openai", "", "sk", "gpt-4o-mini"), "ping")) == ["po", "ng"]
        kwargs = mock_completion.call_args.kwargs
        assert kwargs["provider"] == "openai"
        assert kwargs["stream"] is True
        assert kwargs["messages"] == [{"role": "user", "content": "ping"}]

    @patch("plane.utils.llm.any_llm.completion")
    def test_anthropic_defaults_max_tokens(self, mock_completion):
        mock_completion.return_value = iter([_chunk("pong")])
        assert chat(LLMConfig("anthropic", "", "key", "claude-sonnet-4-5"), "ping") == "pong"
        kwargs = mock_completion.call_args.kwargs
        assert kwargs["provider"] == "anthropic"
        assert kwargs["api_base"] == "https://api.anthropic.com"
        assert kwargs["max_tokens"] == 4096

    @patch("plane.utils.llm.any_llm.responses")
    def test_openai_responses(self, mock_responses):
        mock_responses.return_value = iter(
            [
                SimpleNamespace(type="response.created"),
                SimpleNamespace(type="response.output_text.delta", delta="po"),
                SimpleNamespace(type="response.output_text.delta", delta="ng"),
                SimpleNamespace(type="response.completed"),
            ]
        )
        assert chat(LLMConfig("openai-responses", "", "sk", "gpt-5"), "ping", max_tokens=16) == "pong"
        kwargs = mock_responses.call_args.kwargs
        assert kwargs["input_data"] == "ping"
        assert kwargs["max_output_tokens"] == 16

    @patch("plane.utils.llm.any_llm.completion", side_effect=RuntimeError("boom"))
    def test_error(self, _):
        with pytest.raises(LLMError, match="boom"):
            chat(LLMConfig("openai", "", "sk", "gpt-4o"), "ping")

    def test_model_required(self):
        with pytest.raises(LLMError):
            chat(LLMConfig("openai", "", "sk"), "ping")


@pytest.mark.unit
class TestProviderPresets:
    def test_presets(self):
        presets = {preset["key"]: preset for preset in get_provider_presets()}
        assert presets["openai"]["protocol"] == "openai"
        assert presets["anthropic"]["protocol"] == "anthropic"
        assert presets["gemini"]["protocol"] == "gemini"
        assert presets["deepseek"]["base_url"] == "https://api.deepseek.com"
        assert presets["ollama"]["base_url"] == "http://localhost:11434/v1"
        assert presets["siliconflow"]["protocol"] == "openai"
        # Providers that need cloud credentials are left out
        assert "bedrock" not in presets
        assert "vertexai" not in presets


@pytest.mark.unit
class TestMaskSecret:
    @pytest.mark.parametrize(
        "value,expected",
        [
            ("", ""),
            ("short-key", "****"),
            ("sk-abcdefghijklmnopwxyz", "sk-a****wxyz"),
        ],
    )
    def test_mask(self, value, expected):
        from plane.license.api.serializers.configuration import mask_secret

        assert mask_secret(value) == expected
