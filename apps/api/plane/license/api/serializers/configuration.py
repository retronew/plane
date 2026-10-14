# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from .base import BaseSerializer
from plane.license.models import InstanceConfiguration
from plane.license.utils.encryption import decrypt_data


# Secrets that are never sent back in full: the admin UI shows a masked hint and keeps the
# saved value when the field is submitted empty.
WRITE_ONLY_SECRETS = {"LLM_API_KEY"}


def mask_secret(value: str) -> str:
    """`sk-abcdef...wxyz` -> `sk-a****wxyz`; short values are fully masked."""
    if not value:
        return ""
    if len(value) <= 12:
        return "****"
    return f"{value[:4]}****{value[-4:]}"


class InstanceConfigurationSerializer(BaseSerializer):
    class Meta:
        model = InstanceConfiguration
        fields = "__all__"

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Decrypt secrets value
        if instance.is_encrypted and instance.value is not None:
            data["value"] = decrypt_data(instance.value)
            if instance.key in WRITE_ONLY_SECRETS:
                data["value"] = mask_secret(data["value"])

        return data
