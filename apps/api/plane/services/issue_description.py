import base64
import hashlib
from contextvars import ContextVar

from django.db.models import F
from rest_framework.exceptions import APIException

from plane.db.models.issue_description_document import IssueDescriptionDocument

collaboration_projection = ContextVar("collaboration_projection", default=False)


class DescriptionConflict(APIException):
    status_code = 409
    default_code = "DESCRIPTION_CONFLICT"

    def __init__(self, document):
        super().__init__("Description changed")
        # Preserve numeric CAS tokens; DRF's default APIException coercion turns them into strings.
        self.detail = {"code": "DESCRIPTION_CONFLICT", "epoch": document.epoch, "revision": document.revision}


def description_hash(html):
    return hashlib.sha256((html or "").encode()).hexdigest()


def invalidate_description(issue, previous_html):
    if collaboration_projection.get() or previous_html == issue.description_html:
        return
    IssueDescriptionDocument.objects.filter(issue_id=issue.pk).update(
        epoch=F("epoch") + 1,
        revision=F("revision") + 1,
        state=None,
        source_hash=description_hash(issue.description_html),
        contributors=[],
    )


def document_payload(issue, document, can_edit):
    return {
        "issue_id": str(issue.pk),
        "format": "slate-yjs-v1",
        "schema_version": 1,
        "epoch": document.epoch if document else 0,
        "revision": document.revision if document else 0,
        "state": base64.b64encode(bytes(document.state)).decode() if document and document.state is not None else None,
        "description_html": issue.description_html,
        "source_hash": description_hash(issue.description_html),
        "can_read": True,
        "can_edit": can_edit,
    }
