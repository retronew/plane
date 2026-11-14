import pytest
from bs4 import BeautifulSoup

from plane.mcp.formatting import html_to_markdown, markdown_to_html

pytestmark = pytest.mark.unit


def test_task_list_round_trip_preserves_checks_and_stable_ids():
    markdown = "- [ ] WEQ2-17 implement\n- [x] local-id-42 done"
    html = markdown_to_html(markdown)
    soup = BeautifulSoup(html, "html.parser")
    assert soup.find("ul")["data-type"] == "taskList"
    assert [item["data-checked"] for item in soup.find_all("li")] == ["false", "true"]
    assert html_to_markdown(html) == markdown


def test_existing_editor_task_list_keeps_checked_state():
    html = (
        '<ul data-type="taskList"><li data-type="taskItem" data-checked="true">'
        '<label><input type="checkbox" checked></label><div><p>WEQ2-17</p></div></li></ul>'
    )
    assert html_to_markdown(html) == "- [x] WEQ2-17"


def test_task_marker_inside_code_is_not_a_checkbox():
    html = markdown_to_html("- `[ ] literal`\n\n```text\n- [x] example\n```")
    assert 'data-type="taskItem"' not in html
    assert "[x] example" in html


def test_stable_identifier_is_plain_but_markdown_syntax_stays_escaped():
    assert html_to_markdown("<p>WEQ2-17 *literal*</p>") == r"WEQ2-17 \*literal\*"
