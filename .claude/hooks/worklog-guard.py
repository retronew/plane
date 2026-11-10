#!/usr/bin/env python3
"""Require a daily worklog update after this session changes project files.

Pre/PostToolUse pair shell operations with Git snapshots; direct file tools also
cover ignored configuration files. State is private to the session. No transcript,
command text, source contents or credentials are persisted. Stop blocks once per
pending change, avoiding an infinite loop if a log cannot be written.
"""
import datetime
import fcntl
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

FILE_TOOLS = {"Write", "Edit", "NotebookEdit"}
SHELL_TOOLS = {"Bash"}


def digest(path):
    try:
        if not path.is_file():
            return None
        hasher = hashlib.sha256()
        with path.open("rb") as stream:
            for chunk in iter(lambda: stream.read(131072), b""):
                hasher.update(chunk)
        return hasher.hexdigest()
    except FileNotFoundError:
        return None


def git(root, *args):
    return subprocess.run(
        ["git", "-C", str(root), *args], check=True,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=15,
    ).stdout


def snapshot(root):
    hasher = hashlib.sha256()
    hasher.update(git(root, "rev-parse", "HEAD"))
    # Exclude the log and its state even if a future checkout tracks them.
    hasher.update(git(root, "diff", "--no-ext-diff", "--no-textconv", "--binary", "HEAD", "--", ".", ":(exclude).worklogs"))
    for raw in sorted(git(root, "ls-files", "--others", "--exclude-standard", "-z").split(b"\0")):
        if not raw or raw.startswith(b".worklogs/"):
            continue
        relative = os.fsdecode(raw)
        path = root / relative
        hasher.update(raw + b"\0")
        if path.is_symlink():
            hasher.update(os.fsencode(os.readlink(path)))
        else:
            hasher.update((digest(path) or "missing").encode())
    return hasher.hexdigest()


def project_file(root, payload):
    args = payload.get("tool_input") or {}
    value = args.get("file_path") or args.get("notebook_path")
    if not value:
        return False
    path = Path(value)
    if not path.is_absolute():
        path = Path(payload.get("cwd") or root) / path
    try:
        relative = path.resolve().relative_to(root)
    except ValueError:
        return False
    return bool(relative.parts) and relative.parts[0] not in {".worklogs", ".git"}


def handle(root, payload, state):
    event = payload.get("hook_event_name")
    tool = payload.get("tool_name")
    today = datetime.datetime.now().astimezone().strftime("%Y-%m-%d")
    log = root / ".worklogs" / ("Plane工作日志-" + today + ".md")
    log_hash = digest(log)
    if event == "PreToolUse":
        before = {"log": log_hash, "date": today}
        if tool in SHELL_TOOLS:
            before["git"] = snapshot(root)
        elif tool in FILE_TOOLS and project_file(root, payload):
            args = payload.get("tool_input") or {}
            path = Path(args.get("file_path") or args.get("notebook_path"))
            if not path.is_absolute():
                path = Path(payload.get("cwd") or root) / path
            before["file"] = str(path)
            before["hash"] = digest(path)
        state["before"] = before
    elif event in {"PostToolUse", "PostToolUseFailure"}:
        before = state.pop("before", {})
        changed = False
        if tool in SHELL_TOOLS and "git" in before:
            changed = snapshot(root) != before["git"]
        elif tool in FILE_TOOLS and "file" in before:
            changed = digest(Path(before["file"])) != before.get("hash")
        if changed:
            # A log written by the same shell command is accepted too.
            state["pending"] = {"log": before.get("log"), "date": before.get("date", today)}
            state.pop("warned", None)
    elif event == "Stop" and state.get("pending"):
        pending = state["pending"]
        if log_hash and log.stat().st_size and (pending["date"] != today or log_hash != pending.get("log")):
            state.pop("pending", None)
            state.pop("warned", None)
        elif not state.get("warned"):
            state["warned"] = True
            return {
                "decision": "block",
                "reason": (
                    "工作日志检查：本会话修改了项目文件或产生了提交，但当天日志尚未更新。"
                    f"请先读取并追加 {log}，记录本次改动、验证结果、提交/部署状态与未完成事项；"
                    "保留其他会话的记录，不记录密钥，不编造验证结果。完成后再结束。"
                ),
            }
        else:
            return {"systemMessage": "工作日志仍未补齐。本次为避免循环不再阻止结束；待补写状态已保留。"}
    return None


def main():
    payload = json.load(sys.stdin)
    root = Path(os.environ.get("CLAUDE_PROJECT_DIR") or Path(__file__).resolve().parents[2]).resolve()
    session = str(payload.get("session_id") or "")
    if not session:
        return
    folder = root / ".worklogs" / ".hook-state"
    folder.mkdir(parents=True, exist_ok=True, mode=0o700)
    key = hashlib.sha256(session.encode()).hexdigest()
    # Lock a separate inode so atomic state replacement remains concurrency-safe.
    with (folder / (key + ".lock")).open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        path = folder / (key + ".json")
        state = json.loads(path.read_text()) if path.exists() else {}
        output = handle(root, payload, state)
        temporary = path.with_suffix(".tmp")
        temporary.write_text(json.dumps(state, ensure_ascii=False), encoding="utf-8")
        temporary.replace(path)
    if output:
        print(json.dumps(output, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, subprocess.SubprocessError) as error:
        # Report a broken guard instead of silently claiming that it checked.
        print(json.dumps({"systemMessage": "工作日志 hook 检查失败：" + type(error).__name__}, ensure_ascii=False))
        sys.exit(1)
