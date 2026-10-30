#!/usr/bin/env python3
"""Offline protection tests; no real Docker, network, or deployment."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("retention", HERE / "retention.py")
retention = importlib.util.module_from_spec(spec)
spec.loader.exec_module(retention)


class Protections(unittest.TestCase):
    def shell(self, body):
        return subprocess.run(["bash", "-c", 'source "$1"; ' + body, "test", str(HERE / "deploy.sh")], text=True, capture_output=True)

    def test_service_selection(self):
        for paths, expected in [
            (["apps/web/page.tsx"], "web"),
            (["plugins/example/SKILL.md"], "web"),
            ([".agents/plugins/example/README.md"], "web"),
            ([".claude-plugin/README.md"], "web"),
            (["packages/ui/a.ts"], "web admin space live"),
            (["apps/api/a.py"], "api worker beat-worker migrator"),
            (["apps/web/a", "apps/api/b"], "web api worker beat-worker migrator"),
        ]:
            result = self.shell('OLD=a TARGET=b; git() { printf "%s\\0" ' + " ".join(paths) + '; }; select_services; printf "%s" "${SERVICES[*]}"')
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(result.stdout, expected)

    def test_refuse_infrastructure(self):
        for path in ["docker-compose.yml", "apps/proxy/Caddyfile", ".env", "apps/workflow-runner/main.ts"]:
            result = self.shell(f'OLD=a TARGET=b; git() {{ printf "%s\\0" "{path}"; }}; select_services')
            self.assertNotEqual(result.returncode, 0)

    def test_dirty_and_wrong_branch(self):
        for mock in [
            'git() { if [[ $* == *branch* ]]; then printf other; else return 0; fi; };',
            'git() { if [[ $* == *branch* ]]; then printf preview; else return 1; fi; };',
        ]:
            self.assertNotEqual(self.shell(mock + ' clean').returncode, 0)

    def test_plan_never_fetches_or_calls_docker(self):
        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory)
            def git(*args):
                subprocess.run(["git", "-C", directory, *args], check=True, capture_output=True)
            git("init", "-b", "preview")
            git("-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "--allow-empty", "-m", "initial")
            git("update-ref", "refs/remotes/origin/preview", "HEAD")
            result = subprocess.run(
                ["bash", "-c", 'source "$1"; docker() { exit 99; }; timeout() { exit 99; }; main plan', "test", str(HERE / "deploy.sh")],
                env={**os.environ, "PLANE_ROOT": str(repo)}, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)

    def test_migrator_image_does_not_require_container(self):
        with tempfile.TemporaryDirectory() as directory:
            (Path(directory) / 'compose.json').write_text('{"services":{"migrator":{"image":"plane-migrator"}}}')
            result = self.shell(f'RECORD="{directory}"; ID=test; SERVICES=(migrator); compose() {{ exit 99; }}; docker() {{ if [[ $1 == image ]]; then printf sha256:test; fi; }}; save_images old')
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn('old\tmigrator\tsha256:test', (Path(directory) / 'images.tsv').read_text())

    def test_lock_contention_stops_deployment(self):
        with tempfile.TemporaryDirectory() as directory:
            result = self.shell(f'BACKUPS="{directory}"; flock() {{ return 1; }}; docker() {{ exit 99; }}; main deploy')
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('另一个部署/保留操作正在运行', result.stderr)

    def test_failed_record_blocks_retry_before_docker(self):
        with tempfile.TemporaryDirectory() as directory:
            record = Path(directory) / 'plane-deploy-failed'
            record.mkdir()
            (record / 'owner').write_text('plane-deploy-v1\n')
            (record / 'status').write_text('FAILED phase=building\n')
            result = self.shell(f'BACKUPS="{directory}"; flock() {{ return 0; }}; docker() {{ exit 99; }}; main deploy')
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('存在未完成部署', result.stderr)

    def test_empty_database_dump_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            result = self.shell(f'docker() {{ return 0; }}; dump_db "{directory}/db.dump"')
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('数据库备份为空', result.stderr)

    def test_failure_records_schema_phase_without_rollback(self):
        with tempfile.TemporaryDirectory() as directory:
            result = self.shell(f'RECORD="{directory}"; trap on_exit EXIT; state migrating_schema_may_have_changed; false')
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('FAILED phase=migrating_schema_may_have_changed', (Path(directory) / 'status').read_text())
            self.assertIn('未自动恢复', result.stderr)

    def test_retention_ownership_and_shared_protection(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            image = "sha256:" + "a" * 64
            for day in range(1, 5):
                path = root / f"plane-deploy-202610{day:02}T000000Z-aaaaaaaaaaaa-123"
                path.mkdir()
                (path / "owner").write_text("plane-deploy-v1\n")
                (path / "status").write_text("SUCCESS\n" if day != 1 else "FAILED\n")
                tag = "plane-deploy-record:" + path.name.removeprefix("plane-deploy-") + "-old-web"
                (path / "images.tsv").write_text(f"old\tweb\t{image}\t{tag}\n")
            legacy = root / "old-manual-backup"
            legacy.mkdir()
            def docker(*args):
                if args[:2] == ("ps", "-aq"):
                    return ""
                return json.dumps([{"Id": image, "RepoTags": [args[-1], "plane-web:latest"]}])
            def running_docker(*args):
                if args[:2] == ('ps', '-aq'):
                    return 'container'
                if args[0] == 'inspect':
                    return json.dumps([{'Image': image}])
                return docker(*args)
            with patch.object(retention, 'docker', side_effect=running_docker), patch.object(retention.subprocess, 'run') as remove, patch.object(sys, 'argv', ['retention', directory, '--apply']):
                retention.main()
                remove.assert_not_called()
                self.assertEqual(len(retention.candidates(root)), 3)
            with patch.object(retention, "docker", side_effect=docker), patch.object(retention.subprocess, "run") as remove, patch.object(sys, "argv", ["retention", directory, "--apply"]):
                retention.main()
                remove.assert_called_once()
                self.assertEqual(remove.call_args.args[0], ['docker', 'image', 'rm', '--no-prune', tag.replace('20261004', '20261002')])
            self.assertTrue(legacy.exists())
            self.assertEqual(len(retention.candidates(root)), 2)
            self.assertTrue((root / "plane-deploy-20261001T000000Z-aaaaaaaaaaaa-123").exists())


if __name__ == "__main__":
    import sys
    unittest.main()
