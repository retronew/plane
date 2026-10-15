# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from plane.db.models import BotTypeEnum, Cycle, Issue, IssueView, Label, Module, Page, Project, State, Workspace
from plane.utils.html_processor import strip_tags
from plane.utils.seed_data import load_seed_data, unchanged_seed_fields


class Command(BaseCommand):
    help = "Translate untouched workspace examples. Defaults to a dry run; never replaces user-authored content."

    def add_arguments(self, parser):
        parser.add_argument("--workspace", required=True, help="Workspace slug")
        parser.add_argument("--language", choices=["zh-CN"], default="zh-CN")
        parser.add_argument("--apply", action="store_true")

    @transaction.atomic
    def handle(self, *args, **options):
        workspace = Workspace.objects.filter(slug=options["workspace"]).first()
        if not workspace:
            raise CommandError("Workspace not found")
        # Restrict every query to the system seed bot for this exact workspace.
        scope = {
            "workspace": workspace,
            "created_by__is_bot": True,
            "created_by__bot_type": BotTypeEnum.WORKSPACE_SEED,
            "created_by__username": f"bot_user_{workspace.id}",
        }
        total = 0
        for filename, model in [
            ("projects.json", Project),
            ("states.json", State),
            ("labels.json", Label),
            ("cycles.json", Cycle),
            ("modules.json", Module),
            ("issues.json", Issue),
            ("views.json", IssueView),
            ("pages.json", Page),
        ]:
            original = load_seed_data(settings.SEED_DIR, filename, original=True)
            localized = {row["id"]: row for row in load_seed_data(settings.SEED_DIR, filename, options["language"])}
            for source in original:
                target = localized[source["id"]]
                # The demo project uses the workspace's own name. Other examples have stable original names.
                query = model.objects.select_for_update().filter(**scope)
                if model is Project:
                    query = query.filter(identifier="".join(c for c in workspace.name if c.isalnum())[:5])
                elif model is Issue:
                    query = query.filter(sequence_id=source["sequence_id"], name=source["name"])
                else:
                    query = query.filter(name=source["name"])
                for record in query:
                    updates = unchanged_seed_fields(record, source, target)
                    if model is Page:
                        # Rich collaborative content has its own persisted Yjs state; do not overwrite it.
                        if record.description_binary:
                            updates.pop("description_html", None)
                        elif "description_html" in updates:
                            updates["description_json"] = target["description_json"]
                    if "description_html" in updates:
                        updates["description_stripped"] = strip_tags(updates["description_html"])
                    if not updates:
                        continue
                    total += 1
                    self.stdout.write(f"{model.__name__} {record.id}: {', '.join(updates)}")
                    if options["apply"]:
                        # No updated_by changes, notifications, status moves, or synthetic activity.
                        model.objects.filter(pk=record.pk).update(**updates)
        self.stdout.write(f"{'Updated' if options['apply'] else 'Would update'} {total} examples")
