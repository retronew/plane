"""Exercise fresh worker task loading without importing task modules in the test process."""

import subprocess
import sys

import pytest


@pytest.mark.unit
def test_workspace_sync_tasks_register_with_worker_loader():
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            """
from plane.celery import app

app.loader.import_default_modules()
module = "plane.bgtasks.workspace_sync_task"
assert module in app.conf.imports, "Django configuration discarded the sync task import"
for name in ("publish_workspace_sync_outbox", "prune_workspace_sync_log"):
    task = f"{module}.{name}"
    assert task in app.tasks, f"Worker did not register {task}"
    assert any(entry["task"] == task for entry in app.conf.beat_schedule.values())
""",
        ],
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr
