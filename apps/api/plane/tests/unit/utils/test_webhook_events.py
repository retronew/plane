from plane.app.serializers.webhook import WebhookSerializer
from plane.api.views.webhook import WebhookAPISerializer
from plane.bgtasks.webhook_task import derive_event_types, webhook_wants
from types import SimpleNamespace
import pytest


@pytest.mark.parametrize("serializer", [WebhookSerializer, WebhookAPISerializer])
def test_event_subscription_validation(serializer):
    field = serializer().fields["events"]
    assert field.run_validation(["issue.assigned", "project.created"]) == ["issue.assigned", "project.created"]
    from rest_framework.exceptions import ValidationError

    with pytest.raises(ValidationError):
        field.run_validation(["page.unsupported"])


def test_specific_subscription_does_not_receive_other_actions():
    hook = SimpleNamespace(events=["issue.assigned"])
    assert webhook_wants(hook, "issue", derive_event_types("issue", "updated", "assignees"))
    assert not webhook_wants(hook, "issue", derive_event_types("issue", "created", None))
