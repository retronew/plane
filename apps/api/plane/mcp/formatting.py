# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Markdown <-> HTML conversion and compact JSON for model-facing tool results."""

# Python imports
import json

# Third party imports
import markdown as markdown_lib
from markdownify import markdownify

# Fields that only matter to the web app; dropping them keeps tool output small
NOISE_FIELDS = {
    "workspace",
    "created_by",
    "updated_by",
    "deleted_at",
    "sort_order",
    "view_props",
    "display_filters",
    "display_properties",
    "logo_props",
    "external_id",
    "external_source",
    "description_binary",
    "description_json",
    "description_stripped",
    "type_id",
    "is_draft",
}


def markdown_to_html(text: str | None) -> str:
    if not text:
        return "<p></p>"
    return markdown_lib.markdown(text, extensions=["extra", "sane_lists"])


def html_to_markdown(html: str | None) -> str:
    if not html or html in ("<p></p>", "<p><br></p>"):
        return ""
    return markdownify(html, heading_style="ATX", bullets="-").strip()


def compact(value):
    """Drop empty and web-only fields recursively, and expose HTML bodies as Markdown."""
    if isinstance(value, list):
        return [compact(item) for item in value]
    if not isinstance(value, dict):
        return value
    result = {}
    for key, item in value.items():
        if key in NOISE_FIELDS:
            continue
        if key.endswith("_html") and isinstance(item, str):
            markdown_text = html_to_markdown(item)
            if markdown_text:
                result[key[: -len("_html")] or "body"] = markdown_text
            continue
        item = compact(item)
        if item is None or item == "" or item == [] or item == {}:
            continue
        result[key] = item
    return result


def page_of(data, to_item=compact):
    """Normalise a v1 paginated response into results + a cursor for the next page."""
    if not isinstance(data, dict) or "results" not in data:
        return compact(data)
    page = {"results": [to_item(item) for item in data["results"]]}
    if data.get("next_page_results"):
        page["next_cursor"] = data.get("next_cursor")
    if data.get("total_count") is not None:
        page["total_count"] = data["total_count"]
    return page


def to_text(value) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), default=str)
