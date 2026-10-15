# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json
import re
from pathlib import Path

SEED_FILES = (
    "projects.json",
    "states.json",
    "labels.json",
    "cycles.json",
    "modules.json",
    "issues.json",
    "views.json",
    "pages.json",
)
_TITLE_EMOJI = re.compile("[\U0001f000-\U0001faff\u2600-\u27bf\ufe0f\u200d]")


def clean_seed_title(name):
    return _TITLE_EMOJI.sub("", name).strip()


def load_seed_data(seed_dir, filename, language="en", *, original=False):
    """Read localized example content without turning a user locale into a file path."""
    if filename not in SEED_FILES:
        raise ValueError("Unknown seed file")
    root = Path(seed_dir) / "data"
    locale = "zh-CN" if str(language).lower().replace("_", "-") == "zh-cn" else "en"
    path = root / locale / filename if locale != "en" else root / filename
    with path.open(encoding="utf-8") as source:
        records = json.load(source)
    if not original and filename == "issues.json":
        for record in records:
            record["name"] = clean_seed_title(record["name"])
    return records


def unchanged_seed_fields(record, original, translated):
    """Only replace original example strings, never user edits or relational data."""
    return {
        key: translated[key]
        for key in ("name", "description", "description_html")
        if key in original
        and key in translated
        and getattr(record, key, None) == original[key]
        and original[key] != translated[key]
    }
