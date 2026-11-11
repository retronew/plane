# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.apps import AppConfig


class DbConfig(AppConfig):
    name = "plane.db"

    def ready(self):
        from plane.services.workspace_sync import register_signals

        register_signals()
        # Wrap outside model-specific save overrides (Issue.save locks rows and
        # allocates sequence numbers before calling its base implementation).
        # A base save hook alone would acquire the workspace lock too late.
        from plane.db.mixins import workspace_sync_save
        from plane.services.workspace_sync import SYNC_MODELS

        for model in self.get_models():
            if model._meta.model_name in SYNC_MODELS and not getattr(model.save, "_workspace_sync_wrapped", False):
                model.save = workspace_sync_save(model.save)
