#!/usr/bin/env python3
"""Only retire completed, script-owned records; never prune Docker globally."""
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path


def docker(*args):
    return subprocess.check_output(["docker", *args], text=True).strip()


def candidates(root):
    result = []
    for path in root.iterdir():
        if path.is_symlink() or not path.is_dir():
            continue
        if not re.fullmatch(r"plane-deploy-\d{8}T\d{6}Z-[a-f0-9]{12}-\d+", path.name):
            continue
        if any((path / name).is_symlink() for name in ("owner", "status", "images.tsv")):
            continue
        try:
            if (path / "owner").read_text().strip() == "plane-deploy-v1" and (path / "status").read_text().strip() == "SUCCESS":
                result.append(path)
        except FileNotFoundError:
            continue
    return sorted(result, key=lambda p: p.name, reverse=True)


def main():
    root = Path(sys.argv[1])
    apply = len(sys.argv) == 3 and sys.argv[2] == "--apply"
    records = candidates(root)
    for record in records[2:]:
        rows = [line.split("\t") for line in (record / "images.tsv").read_text().splitlines()]
        expected = "plane-deploy-record:" + record.name.removeprefix("plane-deploy-") + "-"
        if any(len(row) != 4 or not row[3].startswith(expected) or not re.fullmatch(r"sha256:[a-f0-9]{64}", row[2]) for row in rows):
            raise RuntimeError(f"非法镜像清单: {record}")
        print(f"{'清理' if apply else '候选'}记录: {record}")
        pending = False
        for _, _, image_id, tag in rows:
            # Running/stopped container references retain the record for retry.
            # Removing our own tag from a shared image only untags it.
            containers = docker("ps", "-aq") .split()
            used = {item["Image"] for item in json.loads(docker("inspect", *containers))} if containers else set()
            try:
                info = json.loads(docker("image", "inspect", tag))[0]
            except subprocess.CalledProcessError:
                continue  # Previously removed tag; never substitute an image ID.
            if info["Id"] != image_id:
                raise RuntimeError(f"tag 已被改写: {tag}")
            if image_id in used:
                print(f"  保留容器引用镜像与记录，稍后重试: {tag}")
                pending = True
                continue
            print(f"  {'移除' if apply else '可移除'}镜像 tag: {tag}")
            if apply:
                # --no-prune avoids deleting untagged parent/base images.
                subprocess.run(["docker", "image", "rm", "--no-prune", tag], check=True)
        if apply and not pending:
            shutil.rmtree(record)
    print("保留最新两份成功记录；失败记录、其他目录、卷和构建缓存不处理。")


if __name__ == "__main__":
    main()
