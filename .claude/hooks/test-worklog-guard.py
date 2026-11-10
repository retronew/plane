"""Run with python3 -I .claude/hooks/test-worklog-guard.py; uses only disposable repos."""
import datetime
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).with_name("worklog-guard.py")


class WorklogGuardTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="plane-worklog-hook-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.run_git("init", "-q")
        self.run_git("config", "user.email", "test@example.invalid")
        self.run_git("config", "user.name", "Test")
        (self.root / ".gitignore").write_text(".worklogs/\n.claude/\n")
        (self.root / "app.py").write_text("original\n")
        self.run_git("add", ".")
        self.run_git("commit", "-qm", "initial")
        self.log = self.root / ".worklogs" / ("Plane工作日志-" + datetime.date.today().isoformat() + ".md")

    def run_git(self, *args):
        subprocess.run(["git", "-C", str(self.root), *args], check=True, capture_output=True)

    def hook(self, event, tool="Bash", args=None, session="session-a", **extra):
        payload = {"session_id": session, "hook_event_name": event, "tool_name": tool,
                   "cwd": str(self.root), "tool_input": args or {}, **extra}
        result = subprocess.run(
            ["python3", "-I", str(SCRIPT)], input=json.dumps(payload), capture_output=True, text=True,
            env={**os.environ, "CLAUDE_PROJECT_DIR": str(self.root)}, check=True,
        )
        return json.loads(result.stdout) if result.stdout.strip() else {}

    def write_log(self, text="记录本次改动及测试结果\n"):
        self.log.parent.mkdir(exist_ok=True)
        self.log.write_text(text)

    def change(self, tool="Bash", path="app.py"):
        target = self.root / path
        args = {"file_path": str(target)}
        self.hook("PreToolUse", tool, args)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text("changed\n")
        self.hook("PostToolUse", tool, args)

    def test_read_only_with_existing_dirty_files_is_allowed(self):
        (self.root / "app.py").write_text("pre-existing changes\n")
        self.hook("PreToolUse")
        self.hook("PostToolUse")
        self.assertEqual(self.hook("Stop"), {})

    def test_bash_edit_blocks_until_log_changes(self):
        self.write_log("old entry\n")
        self.change()
        self.assertEqual(self.hook("Stop")["decision"], "block")
        self.write_log()
        self.assertEqual(self.hook("Stop", stop_hook_active=True), {})

    def test_no_infinite_stop_loop(self):
        self.change()
        self.assertEqual(self.hook("Stop")["decision"], "block")
        self.assertIn("systemMessage", self.hook("Stop", stop_hook_active=True))

    def test_another_session_without_edits_is_not_blocked(self):
        self.change()
        self.assertEqual(self.hook("Stop", session="session-b"), {})

    def test_direct_edit_of_ignored_config_is_detected(self):
        self.change("Write", ".claude/test.json")
        self.assertEqual(self.hook("Stop")["decision"], "block")

    def test_log_only_write_is_allowed(self):
        args = {"file_path": str(self.log)}
        self.hook("PreToolUse", "Write", args)
        self.write_log()
        self.hook("PostToolUse", "Write", args)
        self.assertEqual(self.hook("Stop"), {})

    def test_commit_is_detected_even_with_clean_worktree(self):
        self.hook("PreToolUse")
        (self.root / "app.py").write_text("committed\n")
        self.run_git("add", "app.py")
        self.run_git("commit", "-qm", "change")
        self.hook("PostToolUse")
        self.assertEqual(self.hook("Stop")["decision"], "block")

    def test_new_untracked_file_is_detected(self):
        self.change(path="new.py")
        self.assertEqual(self.hook("Stop")["decision"], "block")

    def test_same_command_can_change_code_and_update_log(self):
        self.hook("PreToolUse")
        (self.root / "app.py").write_text("changed\n")
        self.write_log()
        self.hook("PostToolUse")
        self.assertEqual(self.hook("Stop"), {})

    def test_failed_shell_can_still_have_changed_files(self):
        self.hook("PreToolUse")
        (self.root / "app.py").write_text("partial change\n")
        self.hook("PostToolUseFailure")
        self.assertEqual(self.hook("Stop")["decision"], "block")


if __name__ == "__main__":
    unittest.main()
