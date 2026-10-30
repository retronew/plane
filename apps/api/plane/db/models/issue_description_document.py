from django.db import models


class IssueDescriptionDocument(models.Model):
    """Slate Yjs state, deliberately separate from legacy ProseMirror binary."""

    issue = models.OneToOneField(
        "db.Issue", primary_key=True, on_delete=models.CASCADE, related_name="collaboration_document"
    )
    format = models.CharField(max_length=32, default="slate-yjs-v1", editable=False)
    schema_version = models.PositiveIntegerField(default=1)
    epoch = models.PositiveBigIntegerField(default=0)
    revision = models.PositiveBigIntegerField(default=0)
    state = models.BinaryField(null=True, editable=False)
    source_hash = models.CharField(max_length=64, blank=True, default="")
    contributors = models.JSONField(default=list)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "issue_description_documents"
