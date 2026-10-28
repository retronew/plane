"""Shared state initialization and non-destructive workspace template application."""

import hashlib
import json
from uuid import uuid4

from django.core import signing
from django.core.serializers.json import DjangoJSONEncoder
from rest_framework.exceptions import ValidationError

from plane.db.models import Project, State, WorkspaceTemplate
from plane.db.models.state import DEFAULT_STATES
from plane.db.models.workflow import ProjectWorkflow
from plane.utils.workflow import WorkflowConflict, validate_state_creation_settings


def state_definitions(project, explicit=None):
    template = WorkspaceTemplate.objects.filter(
        workspace_id=project.workspace_id, is_default_state_template=True, kind="project", project__isnull=True
    ).first()
    definitions = (explicit or {}).get("states") or (template.configuration.get("states") if template else None)
    definitions = [dict(entry) for entry in (definitions or DEFAULT_STATES) if entry["group"] != "triage"]
    if not any(entry.get("default") for entry in definitions):
        next(entry for entry in definitions if entry.get("allow_new_work_items", True))["default"] = True
    return definitions


def initialize_project_states(project, actor=None, explicit=None):
    definitions = state_definitions(project, explicit)
    definitions.append(next(dict(entry) for entry in DEFAULT_STATES if entry["group"] == "triage"))
    return State.objects.bulk_create(
        [
            State(
                project=project,
                workspace_id=project.workspace_id,
                created_by=actor,
                name=entry["name"],
                color=entry["color"],
                group=entry["group"],
                default=entry.get("default", False),
                allow_new_work_items=entry.get("allow_new_work_items", True),
                sequence=entry.get("sequence", index * 10000),
                is_triage=entry["group"] == "triage",
            )
            for index, entry in enumerate(definitions)
        ]
    )


def preview_state_template(project, data):
    template = WorkspaceTemplate.objects.filter(
        workspace_id=project.workspace_id, is_default_state_template=True, kind="project", project__isnull=True
    ).first()
    if not template:
        raise ValidationError({"template": "Configure a workspace default state template first."})
    states = list(State.objects.filter(project=project).order_by("sequence", "id"))
    definitions = state_definitions(project)
    mapping = data.get("mapping", {})
    if not isinstance(mapping, dict) or any(
        str(key) not in {str(i) for i in range(len(definitions))} for key in mapping
    ):
        raise ValidationError({"mapping": "Invalid template state mapping."})
    matched, added, used = [], [], set()
    for index, entry in enumerate(definitions):
        explicit_id = mapping.get(str(index))
        existing = (
            next((state for state in states if str(state.pk) == str(explicit_id)), None)
            if explicit_id
            else next(
                (
                    state
                    for state in states
                    if state.group == entry["group"] and state.name.casefold() == entry["name"].casefold()
                ),
                None,
            )
        )
        if explicit_id and (not existing or existing.group != entry["group"]):
            raise ValidationError({"mapping": "Map only existing states in the same group."})
        if existing and str(existing.pk) in used:
            raise ValidationError({"mapping": "Each existing state can only be matched once."})
        values = {
            key: entry.get(key, True if key == "allow_new_work_items" else False)
            for key in ("name", "color", "group", "default", "allow_new_work_items")
        }
        row = {"index": index, "id": str(existing.pk) if existing else None, "values": values}
        if existing:
            used.add(str(existing.pk))
            row["changes"] = {
                key: {"before": getattr(existing, key), "after": value}
                for key, value in values.items()
                if getattr(existing, key) != value
            }
            matched.append(row)
        else:
            added.append(row)
    retained = [
        {
            "id": str(state.pk),
            "name": state.name,
            "group": state.group,
            "changes": {"default": {"before": True, "after": False}} if state.default else {},
        }
        for state in states
        if str(state.pk) not in used
    ]
    proposed = []
    for state in states:
        copy = State(
            id=state.pk,
            project=project,
            workspace_id=project.workspace_id,
            name=state.name,
            color=state.color,
            group=state.group,
            default=False,
            allow_new_work_items=state.allow_new_work_items,
        )
        row = next((row for row in matched if row["id"] == str(state.pk)), None)
        if row:
            for key, value in row["values"].items():
                setattr(copy, key, value)
        proposed.append(copy)
    proposed.extend(
        State(id=uuid4(), project=project, workspace_id=project.workspace_id, **row["values"]) for row in added
    )
    names = [state.name.casefold() for state in proposed]
    if len(names) != len(set(names)):
        raise ValidationError(
            {"mapping": "A retained state has the same name. Map it in the same group or rename it first."}
        )
    validate_state_creation_settings(project.pk, proposed)
    snapshot = {
        "project": str(project.pk),
        "template": str(template.pk),
        "configuration": template.configuration,
        "mapping": mapping,
        "states": list(State.objects.filter(project=project).order_by("id").values()),
        "workflows": [
            {
                "id": str(workflow.pk),
                "updated_at": workflow.updated_at,
                "initial": str(workflow.initial_state_id),
                "states": sorted(str(pk) for pk in workflow.states.values_list("pk", flat=True)),
                "restricted": sorted(
                    str(pk) for pk in workflow.restricted_creation_states.values_list("pk", flat=True)
                ),
            }
            for workflow in ProjectWorkflow.objects.filter(project=project).order_by("id")
        ],
        "enabled": project.workflow_enabled,
    }
    fingerprint = hashlib.sha256(json.dumps(snapshot, sort_keys=True, cls=DjangoJSONEncoder).encode()).hexdigest()
    return {
        "template": template.name,
        "matched": matched,
        "added": added,
        "retained": retained,
        "token": signing.dumps({"project": str(project.pk), "fingerprint": fingerprint}, salt="state-template-preview"),
    }


def apply_state_template(project, data, actor=None):
    # Caller owns the same project lock used by issue/workflow/state writers.
    project = Project.objects.select_for_update().get(pk=project.pk)
    preview = preview_state_template(project, data)
    try:
        supplied = signing.loads(data.get("token", ""), salt="state-template-preview", max_age=1800)
        expected = signing.loads(preview["token"], salt="state-template-preview")
    except (signing.BadSignature, TypeError) as exc:
        raise WorkflowConflict({"template": "Preview expired. Preview again before applying."}) from exc
    if supplied != expected:
        raise WorkflowConflict({"template": "Configuration changed. Preview again before applying."})
    matched = {row["id"]: row for row in preview["matched"]}
    for state in State.objects.filter(project=project):
        row = matched.get(str(state.pk))
        values = row["values"] if row else {"default": False}
        if any(getattr(state, key) != value for key, value in values.items()):
            for key, value in values.items():
                setattr(state, key, value)
            state.updated_by = actor
            state.save(disable_auto_set_user=True)
    for row in preview["added"]:
        state = State(project=project, workspace_id=project.workspace_id, created_by=actor, **row["values"])
        state.save(disable_auto_set_user=True)
    return preview
