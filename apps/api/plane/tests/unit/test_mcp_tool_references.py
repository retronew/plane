# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Every `tool` + action named in the MCP instructions and the plane-workflow skills must exist."""

import os
import re
from pathlib import Path

import pytest

from plane.mcp.instructions import SERVER_INSTRUCTIONS
from plane.mcp.tools.resources import TOOLS, TOOLS_BY_NAME

# `workitem(action='list')` in the instructions, "`workitem` 工具 `action="get"`" in the skills
CALL_FORM = re.compile(r"\b([a-z_]+)\(action=['\"]([a-z_]+)['\"]")
SKILL_FORM = re.compile(r"`([a-z_]+)` 工具[：:\s]*`?action=\"([a-z_]+)\"")


def _references(text):
    return set(CALL_FORM.findall(text)) | set(SKILL_FORM.findall(text))


def _assert_known(references, source):
    for tool, action in references:
        assert tool in TOOLS_BY_NAME, f"{source}: unknown tool {tool!r}"
        assert TOOLS_BY_NAME[tool].action(action), f"{source}: {tool} has no action {action!r}"


@pytest.mark.unit
def test_instructions_reference_existing_tools():
    references = _references(SERVER_INSTRUCTIONS)
    assert references
    _assert_known(references, "instructions")


@pytest.mark.unit
def test_tool_descriptions_reference_existing_tools():
    for tool in TOOLS:
        _assert_known(_references(tool.definition()["description"]), f"{tool.name} description")


@pytest.mark.unit
def test_plugin_skills_reference_existing_tools():
    # The plugin lives at the repo root; the API test container only mounts apps/api,
    # so point PLANE_PLUGINS_DIR at it (or run from a full checkout)
    plugins_dir = Path(os.environ.get("PLANE_PLUGINS_DIR", Path(__file__).resolve().parents[4] / "plugins"))
    skill_files = list(plugins_dir.glob("plane-workflow/**/*.md"))
    if not skill_files:
        pytest.skip(f"plane-workflow plugin not found under {plugins_dir}")
    total = 0
    for path in skill_files:
        references = _references(path.read_text(encoding="utf-8"))
        total += len(references)
        _assert_known(references, str(path.relative_to(plugins_dir)))
    assert total > 10


@pytest.mark.unit
def test_tool_list_is_compact():
    import json

    payload = json.dumps([tool.definition() for tool in TOOLS], ensure_ascii=False)
    # Tool definitions land in every model context; keep them well under ~60 KB
    assert len(payload.encode("utf-8")) < 60_000, len(payload)
