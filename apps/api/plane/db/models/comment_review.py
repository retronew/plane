import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class IssueCommentReview(models.Model):
    """Append-only human decisions; kept separately from writable comment serializers."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    issue = models.ForeignKey("db.Issue", on_delete=models.CASCADE, related_name="comment_review_events")
    comment = models.ForeignKey("db.IssueComment", null=True, on_delete=models.SET_NULL, related_name="review_events")
    reviewer = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    status = models.CharField(max_length=20, choices=[(s, s) for s in ("justified", "unjustified", "unreviewed")])
    content_fingerprint = models.CharField(max_length=32)
    reviewed_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "issue_comment_reviews"
        ordering = ("-reviewed_at", "-id")
        indexes = [models.Index(fields=["issue", "-reviewed_at", "-id"], name="comment_review_latest_idx")]
