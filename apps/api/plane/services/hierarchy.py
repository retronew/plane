"""Project-scoped hierarchy policy and final-state graph validation.

Callers serialize writes with a Project row lock before locking Issue/DraftIssue.
ProjectIssueType.level is authoritative; IssueType.is_epic retains its legacy meaning.
"""

import hashlib
import json
from functools import partial

from django.core import signing
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from plane.db.models import DraftIssue, Issue, IssueType, Project, ProjectIssueType, WorkspaceTemplate
from plane.utils.workflow import WorkflowConflict


def hierarchy_error(code):
    raise ValidationError({"hierarchy": [code]})


def hierarchy_conflict(code="HIERARCHY_VERSION_CONFLICT"):
    raise WorkflowConflict({"hierarchy": [code]})


def hierarchy_level(project_id, type_id):
    type_id = getattr(type_id, "pk", type_id)
    if type_id is None:
        return 0
    level = (
        ProjectIssueType.objects.filter(project_id=project_id, issue_type_id=type_id)
        .values_list("level", flat=True)
        .first()
    )
    if level is None:
        hierarchy_error("HIERARCHY_INVALID_TYPE")
    return level


def _value(attrs, key, instance):
    if key in attrs:
        return getattr(attrs[key], "pk", attrs[key])
    if key + "_id" in attrs:
        return getattr(attrs[key + "_id"], "pk", attrs[key + "_id"])
    return getattr(instance, key + "_id", None)


def validate_hierarchy_write(project_id, attrs, instance=None):
    """Validate the combined final type/parent, including outgoing child edges."""
    parent_id = _value(attrs, "parent", instance)
    type_id = _value(attrs, "type", instance)
    if project_id is None:
        if parent_id:
            hierarchy_error("HIERARCHY_CROSS_PROJECT")
        return attrs
    project = Project.objects.get(pk=project_id)
    if parent_id:
        parent = Issue.objects.filter(pk=parent_id).first()
        if not parent:
            hierarchy_error("HIERARCHY_INVALID_PARENT")
        if str(parent.project_id) != str(project_id):
            hierarchy_error("HIERARCHY_CROSS_PROJECT")
        # Draft IDs live in a different table and cannot be Issue ancestors.
        issue_id = instance.pk if isinstance(instance, Issue) else None
        seen = {str(issue_id)} if issue_id else set()
        ancestor = parent
        while ancestor:
            if str(ancestor.pk) in seen:
                hierarchy_error("HIERARCHY_CYCLE")
            seen.add(str(ancestor.pk))
            if str(ancestor.project_id) != str(project_id):
                hierarchy_error("HIERARCHY_CROSS_PROJECT")
            if not ancestor.parent_id:
                break
            ancestor = Issue.objects.filter(pk=ancestor.parent_id).first()
        if (
            project.hierarchy_enabled
            and hierarchy_level(project_id, parent.type_id) != hierarchy_level(project_id, type_id) + 1
        ):
            hierarchy_error("HIERARCHY_INVALID_LEVEL")
    if project.hierarchy_enabled:
        level = hierarchy_level(project_id, type_id)
        if isinstance(instance, Issue) and (
            str(type_id) != str(instance.type_id) or str(project_id) != str(instance.project_id)
        ):
            # Archived work items and independent drafts still own real parent edges.
            # Reparenting does not change outgoing edges; bulk flattening may repair
            # several old invalid edges together without changing any item type.
            children = list(Issue.objects.filter(parent_id=instance.pk).values_list("project_id", "type_id"))
            children += list(DraftIssue.objects.filter(parent_id=instance.pk).values_list("project_id", "type_id"))
            for child_project, child_type in children:
                if str(child_project) != str(project_id):
                    hierarchy_error("HIERARCHY_CROSS_PROJECT")
                if level != hierarchy_level(project_id, child_type) + 1:
                    hierarchy_error("HIERARCHY_CHILDREN_CONFLICT")
    return attrs


def ensure_project_type_owned(binding):
    """Copy a shared type, updating every project-scoped reference atomically."""
    original = binding.issue_type
    if not ProjectIssueType.objects.filter(issue_type=original).exclude(project_id=binding.project_id).exists():
        return original, {}
    clone = IssueType.objects.create(
        workspace_id=original.workspace_id,
        name=original.name,
        description=original.description,
        logo_props=original.logo_props,
        is_active=original.is_active,
        level=binding.level,
        is_epic=original.is_epic,
        external_source=original.external_source,
        external_id=original.external_id,
    )
    Issue.objects.filter(project_id=binding.project_id, type=original).update(type=clone)
    DraftIssue.objects.filter(project_id=binding.project_id, type=original).update(type=clone)

    def replace_type(value):
        if isinstance(value, list):
            return [replace_type(v) for v in value]
        if isinstance(value, dict):
            return {
                key: str(clone.pk)
                if key in ("type_id", "issue_type_id", "type") and str(item) == str(original.pk)
                else replace_type(item)
                for key, item in value.items()
            }
        return value

    for template in WorkspaceTemplate.objects.filter(project_id=binding.project_id, kind="work_item").order_by("id"):
        configuration = replace_type(template.configuration)
        if configuration != template.configuration:
            template.configuration = configuration
            template.save(update_fields=["configuration", "updated_at"])
    binding.issue_type = clone
    binding.save(update_fields=["issue_type", "updated_at"])
    return clone, {str(original.pk): str(clone.pk)}


def hierarchy_config(project, can_manage=False, issue_types=None):
    bindings = list(ProjectIssueType.objects.filter(project=project).order_by("level", "id"))
    result = {
        "enabled": project.hierarchy_enabled,
        "default_level": project.hierarchy_default_level,
        "policy_version": project.workflow_version,
        "can_manage": can_manage,
        "levels": sorted({0, project.hierarchy_default_level, *(b.level for b in bindings)}),
        "type_levels": [{"type_id": str(b.issue_type_id), "level": b.level} for b in bindings],
    }
    if issue_types is not None:
        result["issue_types"] = issue_types
    return result


def _normalized_config(project, data):
    if data["policy_version"] != project.workflow_version:
        hierarchy_conflict()
    if project.hierarchy_enabled and not data["enabled"]:
        hierarchy_error("HIERARCHY_CANNOT_DISABLE")
    bindings = list(ProjectIssueType.objects.filter(project=project).select_related("issue_type").order_by("id"))
    entries = data["type_levels"]
    requested = {str(entry["type_id"]): entry["level"] for entry in entries}
    if len(requested) != len(entries):
        hierarchy_error("HIERARCHY_DUPLICATE_TYPE")
    if set(requested) != {str(b.issue_type_id) for b in bindings}:
        hierarchy_error("HIERARCHY_COMPLETE_TYPE_MAPPING_REQUIRED")
    # Level zero always exists for untyped work items. Do not allocate range(max_level).
    levels = sorted({0, *requested.values()})
    if data["default_level"] not in levels:
        hierarchy_error("HIERARCHY_INVALID_DEFAULT_LEVEL")
    normalized = {level: index for index, level in enumerate(levels)}
    return bindings, {
        "enabled": data["enabled"],
        "default_level": normalized[data["default_level"]],
        "policy_version": project.workflow_version,
        "levels": list(range(len(levels))),
        "type_levels": [
            {"type_id": type_id, "level": normalized[level]} for type_id, level in sorted(requested.items())
        ],
    }


def preview_hierarchy(project, data):
    bindings, config = _normalized_config(project, data)
    levels = {entry["type_id"]: entry["level"] for entry in config["type_levels"]}
    issue_rows = list(
        Issue.objects.filter(project=project)
        .order_by("id")
        .values("id", "name", "parent_id", "type_id", "project_id", "updated_at", "archived_at", "is_draft")
    )
    draft_rows = list(
        DraftIssue.objects.filter(project=project)
        .order_by("id")
        .values("id", "name", "parent_id", "type_id", "project_id", "updated_at")
    )
    parents = {str(row["id"]): row for row in issue_rows}
    missing = {
        row["parent_id"] for row in issue_rows + draft_rows if row["parent_id"] and str(row["parent_id"]) not in parents
    }
    for row in Issue.objects.filter(pk__in=missing).values(
        "id", "name", "parent_id", "type_id", "project_id", "updated_at"
    ):
        parents[str(row["id"])] = row

    def level(row):
        if row["type_id"] is None:
            return 0
        return levels.get(str(row["type_id"]))

    conflicts = []
    for kind, rows in (("issue", issue_rows), ("draft", draft_rows)):
        for row in rows:
            if not row["parent_id"]:
                continue
            parent = parents.get(str(row["parent_id"]))
            reason = None
            if not parent:
                reason = "HIERARCHY_INVALID_PARENT"
            elif str(parent["project_id"]) != str(project.pk):
                reason = "HIERARCHY_CROSS_PROJECT"
            elif config["enabled"] and (level(row) is None or level(parent) is None):
                reason = "HIERARCHY_INVALID_TYPE"
            elif config["enabled"] and level(parent) != level(row) + 1:
                reason = "HIERARCHY_INVALID_LEVEL"
            if kind == "issue" and not reason:
                seen = {str(row["id"])}
                ancestor = parent
                while ancestor:
                    if str(ancestor["id"]) in seen:
                        reason = "HIERARCHY_CYCLE"
                        break
                    seen.add(str(ancestor["id"]))
                    ancestor = parents.get(str(ancestor["parent_id"])) if ancestor["parent_id"] else None
            if reason:
                conflicts.append(
                    {
                        "kind": kind,
                        "id": str(row["id"]),
                        "name": row["name"],
                        "parent_id": str(row["parent_id"]),
                        "parent_name": parent["name"] if parent else None,
                        "level": level(row),
                        "parent_level": level(parent) if parent else None,
                        "reason": reason,
                    }
                )
    snapshot = {
        "config": config,
        "current": hierarchy_config(project),
        "bindings": [
            {
                "id": str(b.pk),
                "type_id": str(b.issue_type_id),
                "level": b.level,
                "active": b.issue_type.is_active,
                "updated_at": b.issue_type.updated_at,
            }
            for b in bindings
        ],
        "issues": issue_rows,
        "drafts": draft_rows,
        "parents": parents,
    }
    fingerprint = hashlib.sha256(json.dumps(snapshot, sort_keys=True, default=str).encode()).hexdigest()
    token = signing.dumps({"project": str(project.pk), "fingerprint": fingerprint}, salt="hierarchy-preview")
    return {**config, "conflict_count": len(conflicts), "examples": conflicts[:10], "token": token}, conflicts, bindings


def apply_hierarchy(project, data, actor):
    preview, conflicts, bindings = preview_hierarchy(project, data)
    try:
        supplied = signing.loads(data.get("token", ""), salt="hierarchy-preview", max_age=1800)
        expected = signing.loads(preview["token"], salt="hierarchy-preview")
    except signing.BadSignature:
        hierarchy_conflict("HIERARCHY_PREVIEW_STALE")
    if supplied != expected:
        hierarchy_conflict("HIERARCHY_PREVIEW_STALE")
    if conflicts and not data.get("confirm_detach", False):
        hierarchy_error("HIERARCHY_DETACH_CONFIRMATION_REQUIRED")
    before = hierarchy_config(project)
    # Snapshot validation ran under the Project lock; normal writers share that lock.
    # Lock in stable order before clearing real edges or remapping shared types.
    list(Issue.objects.select_for_update().filter(project=project).order_by("id").values_list("id", flat=True))
    list(DraftIssue.objects.select_for_update().filter(project=project).order_by("id").values_list("id", flat=True))
    from plane.bgtasks.issue_activities_task import issue_activity

    now = timezone.now()
    for conflict in conflicts:
        model = Issue if conflict["kind"] == "issue" else DraftIssue
        model.objects.filter(pk=conflict["id"], project=project).update(parent=None, updated_at=now)
        if conflict["kind"] == "issue":
            transaction.on_commit(
                partial(
                    issue_activity.delay,
                    type="issue.activity.updated",
                    requested_data=json.dumps({"parent_id": None}),
                    current_instance=json.dumps({"parent_id": conflict["parent_id"]}),
                    actor_id=str(actor.pk),
                    issue_id=conflict["id"],
                    project_id=str(project.pk),
                    epoch=int(now.timestamp()),
                    notification=True,
                )
            )
    target_levels = {entry["type_id"]: entry["level"] for entry in preview["type_levels"]}
    type_id_map = {}
    for binding in bindings:
        target = target_levels[str(binding.issue_type_id)]
        if target != binding.level or binding.issue_type.level != target:
            issue_type, mapping = ensure_project_type_owned(binding)
            type_id_map.update(mapping)
            binding.level = target
            binding.save(update_fields=["level", "updated_at"])
            issue_type.level = target
            issue_type.save(update_fields=["level", "updated_at"])
    project.hierarchy_enabled = preview["enabled"]
    project.hierarchy_default_level = preview["default_level"]
    project.workflow_version += 1
    project.save(update_fields=["hierarchy_enabled", "hierarchy_default_level", "workflow_version", "updated_at"])
    from plane.services.workflow import record_workflow_activity

    record_workflow_activity(
        project,
        None,
        "hierarchy",
        before=before,
        after={**hierarchy_config(project), "detached_count": len(conflicts), "type_id_map": type_id_map},
    )
    return preview, type_id_map
