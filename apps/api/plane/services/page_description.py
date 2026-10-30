import base64
import hashlib
import json

from django.db.models import F

from plane.db.models.page_description_document import PageDescriptionDocument
from plane.services.issue_description import collaboration_projection


def page_description_hash(page):
    return hashlib.sha256(json.dumps([page.name, page.description_html], ensure_ascii=False).encode()).hexdigest()


def invalidate_page_description(page, previous):
    if collaboration_projection.get() or previous == (page.name, page.description_html):
        return
    PageDescriptionDocument.objects.filter(page_id=page.pk).update(
        epoch=F("epoch") + 1,
        revision=F("revision") + 1,
        state=None,
        source_hash=page_description_hash(page),
        contributors=[],
    )


def page_document_payload(page, document, can_edit):
    return {
        "page_id": str(page.pk),
        "format": "slate-yjs-v1",
        "schema_version": 1,
        "epoch": document.epoch if document else 0,
        "revision": document.revision if document else 0,
        "state": base64.b64encode(bytes(document.state)).decode() if document and document.state is not None else None,
        "description_html": page.description_html,
        "name": page.name,
        "source_hash": page_description_hash(page),
        "can_read": True,
        "can_edit": can_edit,
    }
