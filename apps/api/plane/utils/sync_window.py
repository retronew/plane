# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only

from uuid import UUID

from rest_framework.exceptions import ParseError

MAX_WINDOW_MEMBERS = 5000


class SyncWindow:
    """Validated request options and post-serialization window projection."""

    def __init__(self, params):
        if params.get("sync_window") != "1":
            raise ParseError("Invalid sync_window parameter.")
        try:
            raw_depth = params.get("sync_depth", "1")
            self.depth = int(raw_depth)
            if not 1 <= self.depth <= 20:
                raise ValueError
        except (TypeError, ValueError):
            raise ParseError("sync_depth must be an integer between 1 and 20.")
        self.entity_mode = params.get("sync_entity_mode", "known")
        if self.entity_mode not in {"known", "changed"}:
            raise ParseError("Invalid sync_entity_mode parameter.")
        self.known = self._ids(params, "sync_known_ids", 2000)
        self.changed = self._ids(params, "sync_changed_ids", 200)

    @staticmethod
    def _ids(params, name, maximum):
        raw = params.get(name, "")
        if not raw:
            return set()
        parts = raw.split(",")
        if len(parts) > maximum:
            raise ParseError(f"{name} cannot exceed {maximum} UUIDs.")
        try:
            return {str(UUID(value)) for value in parts}
        except (ValueError, TypeError, AttributeError):
            raise ParseError(f"{name} must be comma-separated UUIDs.")

    def project(self, results):
        entities = {}
        members = 0

        def walk(value):
            nonlocal members
            if isinstance(value, list):
                ids = []
                for entity in value:
                    members += 1
                    if members > MAX_WINDOW_MEMBERS:
                        raise OverflowError
                    entity_id = str(entity["id"])
                    ids.append(entity_id)
                    if entity_id in self.changed or (self.entity_mode == "known" and entity_id not in self.known):
                        entities[entity_id] = entity
                return ids
            return {key: {**group, "results": walk(group["results"])} for key, group in value.items()}

        try:
            mapped = walk(results)
        except OverflowError:
            return {"results": [] if isinstance(results, list) else {}, "entities": [], "reset_required": True}
        return {"results": mapped, "entities": list(entities.values()), "reset_required": False}
