"""Project custom property schemas and lossless issue value validation."""

import math
from datetime import date
from uuid import UUID

from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import URLValidator
from rest_framework.exceptions import ValidationError

from plane.db.models import CustomPropertyOption, IssueTypeCustomProperty, ProjectCustomProperty, ProjectMember


def merge_error(code):
    raise ValidationError({"code": code})


def merge_property_plan(project, source_ids):
    """Caller must hold the Project lock, including for a consistent preview."""
    from plane.db.models import DraftIssue, Issue

    properties = list(ProjectCustomProperty.objects.filter(project=project, pk__in=source_ids, is_archived=False))
    if len(properties) != len(source_ids):
        merge_error("CUSTOM_PROPERTY_MERGE_INVALID_SOURCES")
    by_id = {p.pk: p for p in properties}
    properties = [by_id[key] for key in source_ids]
    first = properties[0]
    config = validate_config(first.property_type, first.config, first.is_required)
    for prop in properties[1:]:
        if prop.property_type != first.property_type:
            merge_error("CUSTOM_PROPERTY_MERGE_TYPE_MISMATCH")
        other_config = validate_config(prop.property_type, prop.config, prop.is_required)
        if other_config.get("multiple") != config.get("multiple"):
            merge_error("CUSTOM_PROPERTY_MERGE_CONFIG_CONFLICT")
        if first.property_type == "dropdown":
            comparable = {k: v for k, v in config.items() if k != "default_value"}
            other_comparable = {k: v for k, v in other_config.items() if k != "default_value"}
            defaults = [config.get("default_value"), other_config.get("default_value")]
            if config.get("multiple"):
                config["default_value"] = (
                    list(dict.fromkeys(v for default in defaults for v in (default or []))) or None
                )
            else:
                nonempty_defaults = [v for v in defaults if v is not None]
                if len(set(nonempty_defaults)) > 1:
                    merge_error("CUSTOM_PROPERTY_MERGE_DEFAULT_CONFLICT")
                config["default_value"] = next(iter(nonempty_defaults), None)
        else:
            comparable, other_comparable = config, other_config
        if comparable != other_comparable or (prop.is_active, prop.is_required) != (first.is_active, first.is_required):
            merge_error("CUSTOM_PROPERTY_MERGE_CONFIG_CONFLICT")

    if first.property_type == "dropdown" and config.get("multiple") and len(config.get("default_value") or []) > 500:
        merge_error("CUSTOM_PROPERTY_MERGE_DEFAULT_CONFLICT")

    bindings = list(IssueTypeCustomProperty.all_objects.filter(property_id__in=source_ids).order_by("id"))
    type_ids = [b.project_issue_type_id for b in bindings]
    if len(set(type_ids)) != len(type_ids):
        merge_error("CUSTOM_PROPERTY_MERGE_TYPE_BINDING_CONFLICT")
    options = list(CustomPropertyOption.all_objects.filter(property_id__in=source_ids).order_by("id"))
    names = [o.name for o in options if not o.is_archived and o.deleted_at is None]
    if len(set(names)) != len(names):
        merge_error("CUSTOM_PROPERTY_MERGE_OPTION_CONFLICT")
    keys = [str(p.pk) for p in properties]
    rows = []
    counts = {}
    for model, count_key in ((Issue, "work_items_count"), (DraftIssue, "draft_count")):
        count = 0
        for row in (
            model.all_objects.filter(project_id=project.pk, custom_properties__has_any_keys=keys)
            .only("id", "custom_properties")
            .iterator(chunk_size=500)
        ):
            values = row.custom_properties
            present = [values[key] for key in keys if key in values]
            nonempty = [v for v in present if not (v is None or v == [] or (isinstance(v, str) and not v.strip()))]
            if len(nonempty) > 1:
                merge_error("CUSTOM_PROPERTY_MERGE_VALUE_CONFLICT")
            # Keep an explicit empty value when all source values are empty.
            value = nonempty[0] if nonempty else present[0]
            rows.append((model, row.pk, {k: v for k, v in values.items() if k not in keys}, value))
            count += 1
        counts[count_key] = count
    return (
        properties,
        config,
        bindings,
        options,
        rows,
        {"merged_count": len(properties), **counts, "type_count": len(set(type_ids))},
    )


def apply_property_merge(project, plan, name, description):
    """Apply a validated plan inside the caller's Project-locked transaction."""
    properties, config, bindings, options, rows, counts = plan
    if ProjectCustomProperty.objects.filter(project=project, name=name, is_archived=False).exists():
        merge_error("CUSTOM_PROPERTY_DUPLICATE_NAME")
    first = properties[0]
    target = ProjectCustomProperty.objects.create(
        project=project,
        name=name,
        description=description,
        property_type=first.property_type,
        config=config,
        is_active=first.is_active,
        is_required=first.is_required,
        sort_order=min(p.sort_order for p in properties),
    )
    target_key = str(target.pk)
    for model, pk, remaining, value in rows:
        model.all_objects.filter(pk=pk).update(custom_properties={**remaining, target_key: value})
    CustomPropertyOption.all_objects.filter(pk__in=[o.pk for o in options]).update(property=target)
    IssueTypeCustomProperty.all_objects.filter(pk__in=[b.pk for b in bindings]).update(property=target)
    ProjectCustomProperty.objects.filter(pk__in=[p.pk for p in properties]).update(is_archived=True, is_active=False)
    return target, counts


DATE_FORMATS = ("YYYY-MM-DD", "DD-MM-YYYY", "MM-DD-YYYY", "DD/MM/YYYY")
CONFIG_DEFAULTS = {
    "text": {"multiline": False, "read_only": False, "default_value": ""},
    "number": {"default_value": None},
    "dropdown": {"multiple": False, "default_value": None},
    "boolean": {"default_value": False},
    "date": {"format": "YYYY-MM-DD"},
    "url": {},
    "member": {"multiple": False},
}


def error(code, key="custom_properties"):
    raise ValidationError({key: code})


def finite_number(value):
    return type(value) in (int, float) and abs(value) <= 1e100 and math.isfinite(value)


def validate_config(kind, config, required=False):
    if not isinstance(config, dict) or set(config) - set(CONFIG_DEFAULTS[kind]):
        error("CUSTOM_PROPERTY_INVALID_CONFIG", "config")
    result = {**CONFIG_DEFAULTS[kind], **config}
    for key in ("multiple", "multiline", "read_only"):
        if key in result and type(result[key]) is not bool:
            error("CUSTOM_PROPERTY_INVALID_CONFIG", "config")
    default = result.get("default_value")
    if kind == "text" and (not isinstance(default, str) or len(default) > 10000):
        error("CUSTOM_PROPERTY_INVALID_CONFIG", "config")
    if kind == "number" and default is not None and not finite_number(default):
        error("CUSTOM_PROPERTY_INVALID_CONFIG", "config")
    if kind == "boolean" and type(default) is not bool:
        error("CUSTOM_PROPERTY_INVALID_CONFIG", "config")
    if kind == "date" and result["format"] not in DATE_FORMATS:
        error("CUSTOM_PROPERTY_INVALID_CONFIG", "config")
    if required and (kind == "boolean" or result.get("read_only")):
        error("CUSTOM_PROPERTY_REQUIRED_NOT_SUPPORTED", "is_required")
    if result.get("read_only") and not default.strip():
        error("CUSTOM_PROPERTY_READ_ONLY_DEFAULT_REQUIRED", "config")
    return result


def effective_properties(project_id, type_id):
    bindings = (
        {
            str(b.property_id): b
            for b in IssueTypeCustomProperty.objects.filter(
                project_id=project_id,
                project_issue_type__issue_type_id=type_id,
                project_issue_type__deleted_at__isnull=True,
            )
        }
        if type_id
        else {}
    )
    result = []
    for prop in ProjectCustomProperty.objects.filter(project_id=project_id, is_archived=False):
        binding = bindings.get(str(prop.pk))
        active = prop.is_active and (binding.is_active if binding else not type_id)
        required = binding.is_required if binding else prop.is_required
        result.append((prop, active, required))
    return result


def validate_value(prop, value, project_id, previous=None):
    if value is None:
        return None
    kind, config = prop.property_type, prop.config
    valid = False
    if kind == "text":
        valid = isinstance(value, str) and len(value) <= 10000
    elif kind == "number":
        valid = finite_number(value)
    elif kind == "boolean":
        valid = type(value) is bool
    elif kind == "date":
        try:
            valid = isinstance(value, str) and date.fromisoformat(value).isoformat() == value
        except ValueError:
            pass
    elif kind == "url":
        if isinstance(value, str) and len(value) <= 2048:
            try:
                URLValidator(schemes=["http", "https"])(value)
                valid = True
            except DjangoValidationError:
                pass
    elif kind in ("dropdown", "member"):
        multiple = config.get("multiple", False)
        values = value if multiple else [value]
        if not isinstance(values, list) or len(values) > 500:
            error("CUSTOM_PROPERTY_INVALID_VALUE", str(prop.pk))
        try:
            if any(not isinstance(v, str) for v in values):
                raise ValueError
            ids = [str(UUID(v)) for v in values]
        except (ValueError, TypeError, AttributeError):
            error("CUSTOM_PROPERTY_INVALID_REFERENCE", str(prop.pk))
        if len(set(ids)) != len(ids):
            error("CUSTOM_PROPERTY_DUPLICATE_VALUE", str(prop.pk))
        # Existing references remain editable after options are archived or members leave.
        # Only newly introduced references must still be eligible.
        previous_values = previous if isinstance(previous, list) else [previous]
        retained = {str(v) for v in previous_values if v is not None}
        new_ids = set(ids) - retained
        if kind == "dropdown":
            eligible = CustomPropertyOption.objects.filter(
                property=prop, project_id=project_id, is_active=True, is_archived=False, pk__in=new_ids
            ).count()
        else:
            eligible = (
                ProjectMember.objects.filter(
                    project_id=project_id,
                    is_active=True,
                    member_id__in=new_ids,
                    member__is_active=True,
                    member__member_workspace__workspace_id=prop.workspace_id,
                    member__member_workspace__is_active=True,
                    member__member_workspace__deleted_at__isnull=True,
                )
                .values("member_id")
                .distinct()
                .count()
            )
        if eligible != len(new_ids):
            error("CUSTOM_PROPERTY_INVALID_REFERENCE", str(prop.pk))
        return ids if multiple else ids[0]
    if not valid:
        error("CUSTOM_PROPERTY_INVALID_VALUE", str(prop.pk))
    return value


def issue_property_values(project_id, attrs, instance=None, *, draft=False):
    """Merge submitted keys; retain disabled, archived and former-type values verbatim."""
    creating = instance is None
    changed_type = "type" in attrs and getattr(attrs["type"], "pk", attrs["type"]) != getattr(instance, "type_id", None)
    existing = dict(getattr(instance, "custom_properties", {}) or {})
    if draft and instance and str(instance.project_id) != str(project_id):
        # Property IDs belong to one project. Keep the original draft intact until
        # the caller explicitly clears its values before moving it.
        if any(value is not None for value in existing.values()):
            error("CUSTOM_PROPERTY_PROJECT_CHANGE_REQUIRES_CLEAR")
        existing = {}
    patch = attrs.get("custom_properties", {})
    if not isinstance(patch, dict) or len(patch) > 500:
        error("CUSTOM_PROPERTY_INVALID_VALUES")
    try:
        canonical = {str(UUID(key)): value for key, value in patch.items()}
    except (ValueError, TypeError, AttributeError):
        error("CUSTOM_PROPERTY_INVALID_PROPERTY")
    if len(canonical) != len(patch):
        error("CUSTOM_PROPERTY_INVALID_PROPERTY")
    target_type = attrs.get("type", getattr(instance, "type_id", None))
    target_type = getattr(target_type, "pk", target_type)
    properties = effective_properties(project_id, target_type)
    available = {str(p.pk): (p, active) for p, active, _ in properties}
    for key, value in canonical.items():
        if key not in available or not available[key][1]:
            error("CUSTOM_PROPERTY_INACTIVE_OR_UNKNOWN", key)
        prop = available[key][0]
        if prop.config.get("read_only"):
            error("CUSTOM_PROPERTY_READ_ONLY", key)
        existing[key] = validate_value(prop, value, project_id, previous=existing.get(key))
    enforce = not draft and not attrs.get("is_draft", getattr(instance, "is_draft", False))
    for prop, active, required in properties:
        key = str(prop.pk)
        if not active:
            continue
        if creating and key not in existing and "default_value" in prop.config:
            default = prop.config["default_value"]
            if default is not None:
                existing[key] = validate_value(prop, default, project_id)
        publishing = bool(getattr(instance, "is_draft", False)) and not attrs.get("is_draft", True)
        if enforce and required and (creating or changed_type or key in canonical or publishing):
            value = existing.get(key)
            if value is None or value == [] or (isinstance(value, str) and not value.strip()):
                error("CUSTOM_PROPERTY_REQUIRED", key)
    return existing
