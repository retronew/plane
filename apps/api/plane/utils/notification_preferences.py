"""Unified personal notification policy, shared by every delivery channel."""

from django.db import transaction
from django.db.models import Q

from plane.db.models import User, UserNotificationPreference
from plane.db.models.notification_preference import NotificationPreference

CHANNELS = ("in_app", "email", "feishu")
EVENTS = (
    "property_change",
    "state_change",
    "issue_completed",
    "comment",
    "mention",
    "due_reminder",
    "approval_requested",
    "intake_created",
)
CHANNEL_DEFAULTS = {"in_app": True, "email": True, "feishu": False}
LEGACY_EVENTS = {
    "property_change": "property_change",
    "state_change": "state_change",
    "issue_completed": "issue_completed",
    "comment": "comment",
    "mention": "mention",
    "due_reminder": "property_change",
    "approval_requested": "state_change",
    "intake_created": "property_change",
}


def _id(value):
    return getattr(value, "pk", value)


def legacy_email_defaults(legacy):
    """Also usable by a data migration with a historical legacy model instance."""
    return {event: getattr(legacy, field, True) for event, field in LEGACY_EVENTS.items()}


def resolve_policy(global_preference, workspace_preference, project_preference, legacy, event, channel):
    """Pure resolver; a false global channel switch is always a hard gate."""
    if channel not in CHANNELS or event not in EVENTS:
        raise ValueError("Unknown notification event or channel")
    channels = global_preference.channels if global_preference else {}
    if not channels.get(channel, CHANNEL_DEFAULTS[channel]):
        return {"enabled": False, "source": "channel_disabled"}
    overrides = global_preference.override_scopes if global_preference else {}
    if not overrides.get(channel, False):
        for preference, source in ((project_preference, "project"), (workspace_preference, "workspace")):
            value = preference.events.get(channel, {}).get(event) if preference else None
            if value is not None:
                return {"enabled": value, "source": source}
    value = global_preference.events.get(channel, {}).get(event) if global_preference else None
    if value is not None:
        return {"enabled": value, "source": "global"}
    if channel == "email" and legacy is not None and event in LEGACY_EVENTS:
        return {"enabled": legacy_email_defaults(legacy)[event], "source": "legacy"}
    return {"enabled": True, "source": "default"}


def load_preferences(user, workspace=None, project=None):
    user_id, workspace_id, project_id = _id(user), _id(workspace), _id(project)
    if project_id is not None and workspace_id is None:
        raise ValueError("A project scope requires a workspace")
    scope = Q(workspace__isnull=True, project__isnull=True)
    if workspace_id is not None:
        scope |= Q(workspace_id=workspace_id, project__isnull=True)
    if project_id is not None:
        scope |= Q(workspace_id=workspace_id, project_id=project_id)
    rows = list(NotificationPreference.objects.filter(scope, user_id=user_id))
    global_preference = next((row for row in rows if row.workspace_id is None), None)
    workspace_preference = next((row for row in rows if row.workspace_id is not None and row.project_id is None), None)
    project_preference = next((row for row in rows if row.project_id is not None), None)
    legacy = UserNotificationPreference.objects.filter(
        user_id=user_id, workspace__isnull=True, project__isnull=True
    ).first()
    return global_preference, workspace_preference, project_preference, legacy


class NotificationPreferenceResolver:
    """A short-lived snapshot: load once for all events/channels for one recipient.

    Keep it within a single dispatch/request; do not cache across tasks, so later
    sends observe preference changes (including channel shutdowns).
    """

    def __init__(self, user, workspace=None, project=None):
        self.preferences = load_preferences(user, workspace, project)

    def resolve(self, event, channel):
        return resolve_policy(*self.preferences, event, channel)

    def should_notify(self, event, channel):
        return self.resolve(event, channel)["enabled"]


def resolve_notification_preference(user, workspace=None, project=None, event=None, channel=None):
    return NotificationPreferenceResolver(user, workspace, project).resolve(event, channel)


def should_notify(user, workspace=None, project=None, event=None, channel=None):
    return resolve_notification_preference(user, workspace, project, event, channel)["enabled"]


def preference_response(user, workspace=None, project=None):
    preferences = load_preferences(user, workspace, project)
    global_preference, workspace_preference, project_preference, legacy = preferences
    current = (
        project_preference
        if project is not None
        else workspace_preference
        if workspace is not None
        else global_preference
    )
    is_global = workspace is None
    events = {
        channel: {event: current.events.get(channel, {}).get(event) if current else None for event in EVENTS}
        for channel in CHANNELS
    }
    if is_global:
        for channel in CHANNELS:
            for event in EVENTS:
                if events[channel][event] is None:
                    events[channel][event] = (
                        legacy_email_defaults(legacy).get(event, True) if channel == "email" else True
                    )
    return {
        "scope": {
            "workspace_id": str(_id(workspace)) if workspace else None,
            "project_id": str(_id(project)) if project else None,
        },
        "channels": {**CHANNEL_DEFAULTS, **(global_preference.channels if global_preference else {})},
        "override_scopes": {
            channel: (global_preference.override_scopes if global_preference else {}).get(channel, False)
            for channel in CHANNELS
        },
        "events": events,
        "effective": {
            channel: {event: resolve_policy(*preferences, event, channel) for event in EVENTS} for channel in CHANNELS
        },
    }


@transaction.atomic
def update_preferences(user, workspace, project, data):
    # Serialize JSON merges, including simultaneous first creation, per user.
    User.objects.select_for_update().get(pk=_id(user))
    preference, _ = NotificationPreference.objects.get_or_create(
        user_id=_id(user), workspace_id=_id(workspace), project_id=_id(project)
    )
    for field in ("channels", "override_scopes"):
        if field in data:
            setattr(preference, field, {**getattr(preference, field), **data[field]})
    for channel, values in data.get("events", {}).items():
        preference.events[channel] = {**preference.events.get(channel, {}), **values}
    preference.save()
    if workspace is None:
        # Keep existing clients reading the five-field endpoint consistent.
        email = data.get("events", {}).get("email", {})
        fields = {event: email[event] for event in LEGACY_EVENTS if event in email and event == LEGACY_EVENTS[event]}
        if fields:
            UserNotificationPreference.objects.update_or_create(
                user_id=_id(user), workspace=None, project=None, defaults=fields
            )
    return preference


def sync_legacy_preferences(user, values):
    """Called after legacy PATCH; explicit new due/approval settings stay independent."""
    preference = NotificationPreference.objects.filter(user_id=_id(user), workspace=None, project=None).first()
    if preference is None:
        return
    email = preference.events.setdefault("email", {})
    for event, field in LEGACY_EVENTS.items():
        if event == field and field in values:
            email[event] = values[field]
    preference.save(update_fields=["events", "updated_at"])
