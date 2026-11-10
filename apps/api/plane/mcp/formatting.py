# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Markdown <-> HTML conversion and compact JSON for model-facing tool results."""

# Python imports
import json
import re
import uuid

# Third party imports
import markdown as markdown_lib
from bs4 import BeautifulSoup
from markdownify import MarkdownConverter

# Stored images and files appear as ![图片](asset:<id>) / [附件：name](asset:<id>);
# workitem(action='images') returns the images themselves
ASSET_PREFIX = "asset:"
UUID_PATTERN = re.compile(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")

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


class _MarkdownConverter(MarkdownConverter):
    def convert_img(self, el, text, convert_as_inline):
        # markdownify keeps only the alt text in headings and table cells; keep the reference
        return super().convert_img(el, text, False)


def as_uuid(value) -> str | None:
    """The canonical form of a hyphenated UUID string, or None."""
    if not isinstance(value, str) or not UUID_PATTERN.fullmatch(value.strip()):
        return None
    return str(uuid.UUID(value.strip()))


def image_asset_id(node) -> str | None:
    """The stored asset behind an image node: ``src`` holds its id, or an asset URL in older content."""
    for key in ("src", "data-asset-id", "assetid"):
        asset_id = as_uuid(node.get(key))
        if asset_id:
            return asset_id
    src = node.get("src") or ""
    if "/api/assets/" in src:
        found = UUID_PATTERN.findall(src.split("?", 1)[0])
        return as_uuid(found[-1]) if found else None
    return None


def _image_src(node) -> str:
    asset_id = image_asset_id(node)
    if asset_id:
        return f"{ASSET_PREFIX}{asset_id}"
    src = (node.get("src") or "").strip()
    # Inline data would flood the output without telling the model anything
    return "data:…" if src.startswith("data:") else src


def _expose_media(soup) -> None:
    """Swap Plane's custom media nodes for tags markdownify converts, instead of silently dropping them."""
    for node in soup.find_all(["image-component", "img"]):
        image = soup.new_tag("img", attrs={"src": _image_src(node), "alt": node.get("alt") or "图片"})
        if node.name == "img":
            node.replace_with(image)
            continue
        # A block in the editor: keep it on its own line
        block = soup.new_tag("p")
        block.append(image)
        node.replace_with(block)
    for node in soup.find_all("attachment-component"):
        asset_id = as_uuid(node.get("src")) or as_uuid(node.get("asset_id"))
        link = soup.new_tag("a", attrs={"href": f"{ASSET_PREFIX}{asset_id}"} if asset_id else {})
        link.string = f"附件：{node.get('name') or node.get_text(strip=True) or '未命名'}"
        block = soup.new_tag("p")
        block.append(link)
        node.replace_with(block)


def html_to_markdown(html: str | None) -> str:
    if not html or html in ("<p></p>", "<p><br></p>"):
        return ""
    soup = BeautifulSoup(html, "html.parser")
    _expose_media(soup)
    return _MarkdownConverter(heading_style="ATX", bullets="-").convert_soup(soup).strip()


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
