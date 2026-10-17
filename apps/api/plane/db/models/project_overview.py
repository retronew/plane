# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.conf import settings
from django.core.serializers.json import DjangoJSONEncoder
from django.core.validators import URLValidator
from django.db import models

from .project import ProjectBaseModel


class ProjectLink(ProjectBaseModel):
    title = models.CharField(max_length=255)
    url = models.URLField(max_length=2048, validators=[URLValidator(schemes=["http", "https"])])

    class Meta:
        db_table = "project_links"
        ordering = ("-created_at", "-id")


class ProjectUpdate(ProjectBaseModel):
    class Health(models.TextChoices):
        ON_TRACK = "on_track", "On track"
        AT_RISK = "at_risk", "At risk"
        OFF_TRACK = "off_track", "Off track"

    body = models.TextField()
    health = models.CharField(max_length=20, choices=Health.choices, default=Health.ON_TRACK)
    # Publication-time counts only; historical updates have no trustworthy snapshot.
    progress = models.JSONField(null=True, blank=True)

    class Meta:
        db_table = "project_updates"
        ordering = ("-created_at", "-id")


class ProjectReaction(ProjectBaseModel):
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="project_reactions")
    reaction = models.CharField(max_length=64)

    class Meta:
        db_table = "project_reactions"
        ordering = ("-created_at", "-id")
        constraints = [
            models.UniqueConstraint(
                fields=["project", "actor", "reaction"],
                condition=models.Q(deleted_at__isnull=True),
                name="project_reaction_unique_active_actor_reaction",
            )
        ]


class ProjectUpdateComment(ProjectBaseModel):
    update = models.ForeignKey(ProjectUpdate, on_delete=models.CASCADE, related_name="comments")
    body = models.TextField()

    class Meta:
        db_table = "project_update_comments"
        ordering = ("created_at", "id")


class ProjectUpdateReaction(ProjectBaseModel):
    update = models.ForeignKey(ProjectUpdate, on_delete=models.CASCADE, related_name="reactions")
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="project_update_reactions"
    )
    reaction = models.CharField(max_length=64)

    class Meta:
        db_table = "project_update_reactions"
        ordering = ("-created_at", "-id")
        constraints = [
            models.UniqueConstraint(
                fields=["update", "actor", "reaction"],
                condition=models.Q(deleted_at__isnull=True),
                name="project_update_reaction_unique_active_actor_reaction",
            )
        ]


class ProjectActivity(ProjectBaseModel):
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="project_activities"
    )
    verb = models.CharField(max_length=30)
    field = models.CharField(max_length=100)
    old_value = models.JSONField(null=True, blank=True, encoder=DjangoJSONEncoder)
    new_value = models.JSONField(null=True, blank=True, encoder=DjangoJSONEncoder)

    class Meta:
        db_table = "project_activities"
        ordering = ("-created_at", "-id")
        indexes = [models.Index(fields=["project", "-created_at", "-id"], name="project_activity_created_idx")]
