# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
import os
import time

# Third party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from .base import BaseAPIView
from plane.license.api.permissions import InstanceAdminPermission
from plane.license.utils.instance_value import get_configuration_value
from plane.utils.llm import (
    LLMConfig,
    LLMError,
    chat,
    get_provider_presets,
    list_models,
    normalize_base_url,
    normalize_protocol,
)


def _config_from_request(request) -> LLMConfig:
    """Build an LLM config from the (unsaved) form values, falling back to the saved API key."""
    protocol = normalize_protocol(request.data.get("protocol"))
    api_key = (request.data.get("api_key") or "").strip()
    if not api_key:
        (api_key,) = get_configuration_value([{"key": "LLM_API_KEY", "default": os.environ.get("LLM_API_KEY", "")}])
    if not api_key:
        raise LLMError("API key is required")
    return LLMConfig(
        protocol=protocol,
        base_url=(request.data.get("base_url") or "").strip(),
        api_key=api_key,
        model=(request.data.get("model") or "").strip(),
    )


class InstanceAIModelsEndpoint(BaseAPIView):
    permission_classes = [InstanceAdminPermission]

    def post(self, request):
        try:
            config = _config_from_request(request)
            base_url = normalize_base_url(config.protocol, config.base_url)
            models = list_models(config)
        except LLMError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"base_url": base_url, "models": models}, status=status.HTTP_200_OK)


class InstanceAITestEndpoint(BaseAPIView):
    permission_classes = [InstanceAdminPermission]

    def post(self, request):
        try:
            config = _config_from_request(request)
            if not config.model:
                raise LLMError("Model is required")
            started = time.monotonic()
            reply = chat(config, "Reply with the single word: pong", max_tokens=16)
            latency_ms = int((time.monotonic() - started) * 1000)
        except LLMError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            {"model": config.model, "reply": reply.strip()[:200], "latency_ms": latency_ms},
            status=status.HTTP_200_OK,
        )


class InstanceAIProvidersEndpoint(BaseAPIView):
    permission_classes = [InstanceAdminPermission]

    def get(self, request):
        return Response(get_provider_presets(), status=status.HTTP_200_OK)
