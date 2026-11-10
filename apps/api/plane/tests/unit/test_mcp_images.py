# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Images in MCP output: Markdown placeholders, format detection and image selection."""

import pytest
from markdownify import markdownify

from plane.mcp.formatting import html_to_markdown
from plane.mcp.images import MAX_IMAGES, ImageRef, _positions, image_type
from plane.mcp.tools.base import ToolError

ASSET = "9b3b60d6-9f89-4d91-bbbb-6150f38e1391"
PROJECT = "cf46377c-fcf3-4e66-ad4f-0b5c29c59468"


@pytest.mark.unit
@pytest.mark.parametrize(
    "html, expected",
    [
        (
            f'<p>Now:</p><image-component src="{ASSET}" width="600px"></image-component><p>Docs:</p>',
            f"Now:\n\n![图片](asset:{ASSET})\n\nDocs:",
        ),
        (f'<image-component src="{ASSET.upper()}"></image-component>', f"![图片](asset:{ASSET})"),
        (f'<image-component src="blob:x" data-asset-id="{ASSET}"></image-component>', f"![图片](asset:{ASSET})"),
        (
            f'<p><img src="/api/assets/v2/workspaces/ws/projects/{PROJECT}/{ASSET}/" alt=""></p>',
            f"![图片](asset:{ASSET})",
        ),
        ('<image-component src="https://example.com/a.png"></image-component>', "![图片](https://example.com/a.png)"),
        ('<image-component src="data:image/png;base64,AAAA"></image-component>', "![图片](data:…)"),
        (
            '<h2>Title <img src="https://example.com/logo.png" alt="logo"></h2>',
            "## Title ![logo](https://example.com/logo.png)",
        ),
        (
            f'<attachment-component src="{ASSET}" name="report.pdf"></attachment-component>',
            f"[附件：report.pdf](asset:{ASSET})",
        ),
        ('<attachment-component asset_id="not-an-id" name="report.pdf"></attachment-component>', "附件：report.pdf"),
    ],
)
def test_media_nodes_become_markdown_placeholders(html, expected):
    assert html_to_markdown(html) == expected


@pytest.mark.unit
def test_image_in_table_cell_keeps_its_reference():
    html = f'<table><tr><th>Shot</th></tr><tr><td><image-component src="{ASSET}"></image-component></td></tr></table>'
    assert f"| ![图片](asset:{ASSET}) |" in html_to_markdown(html)


@pytest.mark.unit
def test_html_without_media_converts_as_before():
    html = (
        '<h1>Goal</h1><p>Steps:</p><ol><li>open</li><li><strong>fail</strong> <a href="https://x.y">link</a></li></ol>'
        "<table><tr><th>a</th></tr><tr><td>b</td></tr></table>"
    )
    assert html_to_markdown(html) == markdownify(html, heading_style="ATX", bullets="-").strip()


@pytest.mark.unit
@pytest.mark.parametrize(
    "data, expected",
    [
        (b"\x89PNG\r\n\x1a\n\0\0", "image/png"),
        (b"\xff\xd8\xff\xe0\0\0", "image/jpeg"),
        (b"GIF89a\0\0", "image/gif"),
        (b"RIFF\0\0\0\0WEBPVP8 ", "image/webp"),
        (b'<svg xmlns="http://www.w3.org/2000/svg"></svg>', None),
        (b"", None),
    ],
)
def test_image_type_trusts_magic_bytes(data, expected):
    assert image_type(data) == expected


@pytest.mark.unit
def test_positions_default_to_first_images_and_accept_index_or_asset_id():
    refs = [ImageRef("描述", asset_id=f"00000000-0000-0000-0000-00000000000{i}") for i in range(8)]
    assert _positions(refs, None) == list(range(MAX_IMAGES))
    assert _positions(refs, ["3", 3, "00000000-0000-0000-0000-000000000007"]) == [2, 7]
    assert _positions(refs, [str(i) for i in range(1, 9)]) == list(range(MAX_IMAGES))


@pytest.mark.unit
@pytest.mark.parametrize("wanted", [["0"], ["9"], ["11111111-1111-1111-1111-111111111111"], ["first"]])
def test_positions_reject_unknown_images(wanted):
    refs = [ImageRef("描述", asset_id=f"00000000-0000-0000-0000-00000000000{i}") for i in range(8)]
    with pytest.raises(ToolError):
        _positions(refs, wanted)


@pytest.mark.unit
def test_comment_pagination_reads_next_page():
    from types import SimpleNamespace
    from unittest.mock import Mock
    from plane.mcp.images import _comments

    api = Mock(
        side_effect=[
            {"results": [{"created_at": "2026-11-02"}], "next_page_results": True, "next_cursor": "page2"},
            {"results": [{"created_at": "2026-11-01"}], "next_page_results": False},
        ]
    )
    comments = _comments(SimpleNamespace(api=api), "items/1/")
    assert [row["created_at"] for row in comments] == ["2026-11-01", "2026-11-02"]
    assert api.call_args.args[2]["cursor"] == "page2"


@pytest.mark.unit
def test_comment_limit_never_returns_silently_incomplete_results():
    from types import SimpleNamespace
    from unittest.mock import Mock
    from plane.mcp.images import MAX_COMMENT_PAGES, _comments

    api = Mock(
        side_effect=[
            {"results": [], "next_page_results": True, "next_cursor": f"page{i}"} for i in range(MAX_COMMENT_PAGES)
        ]
    )
    with pytest.raises(ToolError, match="500"):
        _comments(SimpleNamespace(api=api), "items/1/")
