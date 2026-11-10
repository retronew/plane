# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""
Images in a work item (description, comments, image attachments), returned to the
model as MCP image content blocks.

Access follows the web app: the work item, its comments and attachments are read
through the public API first, and only uploaded assets of that same project are
loaded from storage, so an asset id pasted from another project is never served.
"""

# Python imports
import base64
from dataclasses import dataclass

# Third party imports
from bs4 import BeautifulSoup

# Module imports
from plane.db.models import FileAsset
from plane.mcp.formatting import as_uuid, image_asset_id, to_text
from plane.mcp.tools.base import ToolContent, ToolError, as_list
from plane.settings.storage import S3Storage

MAX_IMAGES = 5
# The Claude API rejects images whose base64 data exceeds 5 MB; base64 adds a third
MAX_IMAGE_BYTES = 3_750_000
MAX_TOTAL_BYTES = 8_000_000
COMMENT_PAGE_SIZE = 100
MAX_COMMENT_PAGES = 5

# Assets the web app serves to any project member; project attachments have their own access rules
READABLE_TYPES = (
    FileAsset.EntityTypeContext.ISSUE_DESCRIPTION,
    FileAsset.EntityTypeContext.COMMENT_DESCRIPTION,
    FileAsset.EntityTypeContext.ISSUE_ATTACHMENT,
    FileAsset.EntityTypeContext.DRAFT_ISSUE_DESCRIPTION,
    FileAsset.EntityTypeContext.PAGE_DESCRIPTION,
)

SHOWN = "已显示"
NOT_SHOWN = "未显示"
OVER_BUDGET = "本次返回已达上限，未显示"
TOO_LARGE = "图片超过 3.75 MB，请在浏览器打开 url"
UNSUPPORTED = "格式不支持预览，请在浏览器打开 url"
EXTERNAL = "外链图片，不读取，请在浏览器打开 url"
MISSING = "找不到图片，或无权访问"
READ_FAILED = "读取失败，请稍后重试或在浏览器打开 url"


@dataclass
class ImageRef:
    source: str
    asset_id: str | None = None
    url: str | None = None
    name: str | None = None


def image_type(data: bytes) -> str | None:
    """The media type the model accepts, judged from the file's magic bytes rather than stored metadata."""
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def _html_images(html, source) -> list[ImageRef]:
    if not html:
        return []
    refs = []
    for node in BeautifulSoup(html, "html.parser").find_all(["image-component", "img"]):
        asset_id = image_asset_id(node)
        src = (node.get("src") or "").strip()
        if asset_id:
            refs.append(ImageRef(source, asset_id=asset_id))
        elif src.startswith(("http://", "https://")):
            refs.append(ImageRef(source, url=src))
    return refs


def _comments(ctx, base) -> list[dict]:
    comments, cursor = [], None
    for _ in range(MAX_COMMENT_PAGES):
        page = ctx.api("GET", f"{base}comments/", {"per_page": COMMENT_PAGE_SIZE, "cursor": cursor})
        comments += page.get("results") or []
        if not page.get("next_page_results"):
            break
        next_cursor = page.get("next_cursor")
        if not next_cursor or next_cursor == cursor:
            raise ToolError("评论分页游标无效，无法完整读取工作项图片。")
        cursor = next_cursor
    else:
        raise ToolError("评论超过本次读取上限（500 条），无法完整列出图片；请在浏览器查看。")
    return sorted(comments, key=lambda comment: comment.get("created_at") or "")


def collect_images(ctx, project_id, work_item_id) -> list[ImageRef]:
    """Every image in reading order: description, comments (oldest first), then image attachments."""
    base = f"projects/{project_id}/work-items/{work_item_id}/"
    refs = _html_images(ctx.api("GET", base).get("description_html"), "描述")
    for comment in _comments(ctx, base):
        created = str(comment.get("created_at") or "")[:16].replace("T", " ")
        refs += _html_images(comment.get("comment_html"), f"评论 {created}".strip())
    for attachment in ctx.api("GET", f"{base}attachments/") or []:
        attributes = attachment.get("attributes") or {}
        if str(attributes.get("type") or "").startswith("image/"):
            refs.append(ImageRef("附件", asset_id=str(attachment["id"]), name=attributes.get("name")))
    unique = {}
    for ref in refs:
        unique.setdefault(ref.asset_id or ref.url, ref)
    return list(unique.values())


def _positions(refs, wanted) -> list[int]:
    """0-based positions to show: the requested images, else the first few."""
    if not wanted:
        return list(range(min(MAX_IMAGES, len(refs))))
    positions = []
    for value in as_list(wanted):
        text = str(value).strip()
        if text.isdigit():
            position = int(text) - 1
            if not 0 <= position < len(refs):
                raise ToolError(f"没有第 {text} 张图片：这个工作项共 {len(refs)} 张。")
        else:
            asset_id = as_uuid(text)
            position = next((i for i, ref in enumerate(refs) if asset_id and ref.asset_id == asset_id), None)
            if position is None:
                raise ToolError(f"这个工作项里没有图片 {text}。请传图片序号（从 1 开始）或资产 ID。")
        if position not in positions:
            positions.append(position)
    return positions[:MAX_IMAGES]


def _number(value) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0


def _load(storage, asset, budget) -> tuple[bytes | None, str | None, str | None]:
    """(bytes, media type, None) for a viewable image, else (None, None, why it is not shown)."""
    size = asset.size or _number((asset.attributes or {}).get("size"))
    if size > MAX_IMAGE_BYTES:
        return None, None, TOO_LARGE
    if size > budget:
        return None, None, OVER_BUDGET
    stored = storage.read_object(asset.asset.name, max_size=MAX_IMAGE_BYTES)
    if stored is None:
        return None, None, READ_FAILED
    data = stored["Body"]
    if len(data) > MAX_IMAGE_BYTES:
        return None, None, TOO_LARGE
    if len(data) > budget:
        return None, None, OVER_BUDGET
    media_type = image_type(data)
    if media_type is None:
        return None, None, UNSUPPORTED
    return data, media_type, None


def work_item_images(ctx, args):
    project_id, work_item_id = ctx.work_item(args.get("work_item"))
    refs = collect_images(ctx, project_id, work_item_id)
    if not refs:
        return {"work_item": args["work_item"], "total": 0, "message": "描述、评论和附件里都没有图片。"}

    positions = _positions(refs, args.get("images"))
    assets = {
        str(asset.id): asset
        for asset in FileAsset.objects.filter(
            id__in=[refs[position].asset_id for position in positions if refs[position].asset_id],
            workspace__slug=ctx.slug,
            project_id=project_id,
            entity_type__in=READABLE_TYPES,
            is_uploaded=True,
            is_deleted=False,
        ).select_related("workspace")
    }
    storage = S3Storage() if assets else None

    entries, blocks, budget = [], [], MAX_TOTAL_BYTES
    for position, ref in enumerate(refs):
        entry = {"index": position + 1, "source": ref.source, "name": ref.name, "asset": ref.asset_id, "url": ref.url}
        asset = assets.get(ref.asset_id) if ref.asset_id else None
        if position not in positions:
            entry["status"] = NOT_SHOWN
        elif ref.url:
            entry["status"] = EXTERNAL
        elif asset is None:
            entry["status"] = MISSING
        else:
            if asset.asset_url:
                entry["url"] = ctx.request.build_absolute_uri(asset.asset_url)
            data, media_type, reason = _load(storage, asset, budget)
            if data is None:
                entry["status"] = reason
            else:
                budget -= len(data)
                entry["status"] = SHOWN
                label = f"图片 {position + 1}（{ref.source}{'：' + ref.name if ref.name else ''}）"
                blocks += [
                    {"type": "text", "text": label},
                    {"type": "image", "data": base64.b64encode(data).decode("ascii"), "mimeType": media_type},
                ]
        entries.append({key: value for key, value in entry.items() if value is not None})

    summary = {"work_item": args["work_item"], "total": len(refs), "images": entries}
    pending = [entry["index"] for entry in entries if entry["status"] in (NOT_SHOWN, OVER_BUDGET)]
    if pending:
        summary["next"] = f"还有 {len(pending)} 张未显示，可传 images={pending[:MAX_IMAGES]} 继续查看。"
    return ToolContent([{"type": "text", "text": to_text(summary)}, *blocks])
