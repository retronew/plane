"""Instance-local, public-client MCP OAuth grants. Credentials are stored as hashes."""

import uuid

from django.conf import settings
from django.db import models


class MCPOAuthClient(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    redirect_uris = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)


class MCPOAuthGrant(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    client = models.ForeignKey(MCPOAuthClient, on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    workspace = models.ForeignKey("db.Workspace", on_delete=models.CASCADE)
    scope = models.CharField(max_length=40)
    resource = models.URLField(max_length=2048)
    redirect_uri = models.URLField(max_length=2048)
    code_hash = models.CharField(max_length=64, unique=True)
    code_challenge = models.CharField(max_length=43)
    code_expires_at = models.DateTimeField()
    code_used = models.BooleanField(default=False)
    revoked = models.BooleanField(default=False)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)


class MCPOAuthToken(models.Model):
    grant = models.ForeignKey(MCPOAuthGrant, on_delete=models.CASCADE)
    access_hash = models.CharField(max_length=64, unique=True)
    refresh_hash = models.CharField(max_length=64, unique=True)
    access_expires_at = models.DateTimeField()
    rotated = models.BooleanField(default=False)
