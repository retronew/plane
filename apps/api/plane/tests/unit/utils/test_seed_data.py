from pathlib import Path
from types import SimpleNamespace

import pytest

from plane.utils.seed_data import SEED_FILES, load_seed_data, unchanged_seed_fields

SEEDS = Path(__file__).resolve().parents[3] / "seeds"
pytestmark = pytest.mark.unit


@pytest.mark.parametrize("filename", SEED_FILES)
def test_chinese_examples_preserve_ids_and_all_relations(filename):
    english = load_seed_data(SEEDS, filename)
    chinese = load_seed_data(SEEDS, filename, "zh-CN")
    assert [row["id"] for row in english] == [row["id"] for row in chinese]
    text_keys = {"name", "description", "description_json", "description_html", "description_stripped"}
    for before, after in zip(english, chinese, strict=True):
        assert {key: value for key, value in before.items() if key not in text_keys} == {
            key: value for key, value in after.items() if key not in text_keys
        }
        assert any("\u4e00" <= char <= "\u9fff" for char in after["name"])


def test_chinese_titles_and_copy_do_not_include_emoji_or_removed_billing_feature():
    for language in ("en", "zh-CN"):
        issues = load_seed_data(SEEDS, "issues.json", language)
        assert all(not any(ord(char) > 0xFFFF or char == "\ufe0f" for char in row["name"]) for row in issues)
    issues = load_seed_data(SEEDS, "issues.json", "zh-CN")
    assert issues[2]["name"] == "2. 邀请团队成员"
    assert "账单" not in issues[-1]["description_html"]
    assert "billing" not in issues[-1]["description_html"]


def test_unsupported_locale_uses_english_and_cannot_inject_a_path():
    assert load_seed_data(SEEDS, "issues.json", "../../zh-CN") == load_seed_data(SEEDS, "issues.json", "en")
    assert load_seed_data(SEEDS, "issues.json", "zh_CN")[2]["name"] == "2. 邀请团队成员"
    with pytest.raises(ValueError):
        load_seed_data(SEEDS, "../issues.json")


def test_backfill_preserves_edited_descriptions_and_non_text_fields():
    source = {"name": "Example", "description_html": "<p>Original</p>", "state_id": 1}
    target = {"name": "示例", "description_html": "<p>中文</p>", "state_id": 2}
    record = SimpleNamespace(name="Example", description_html="<p>My own text</p>", state_id=3)
    assert unchanged_seed_fields(record, source, target) == {"name": "示例"}
    record.name = "My own title"
    assert unchanged_seed_fields(record, source, target) == {}
