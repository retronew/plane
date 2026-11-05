import uuid

from django.db import transaction
from django.utils import timezone
from rest_framework.response import Response

from plane.app.serializers.daily_digest import DailyDigestConfigSerializer
from plane.app.views.base import BaseAPIView
from plane.db.models import DailyDigestConfig, User
from plane.services.daily_digest import build_digest, config_response, schedule_slot, user_zone


class DailyDigestConfigEndpoint(BaseAPIView):
    def get(self, request):
        config = DailyDigestConfig.objects.filter(user=request.user).first() or DailyDigestConfig(user=request.user)
        return Response(config_response(config))

    @transaction.atomic
    def patch(self, request):
        # Serializes first creation too; GET and preview never create rows.
        User.objects.select_for_update().get(pk=request.user.pk)
        config = DailyDigestConfig.objects.select_for_update().filter(user=request.user).first()
        config = config or DailyDigestConfig(user=request.user)
        serializer = DailyDigestConfigSerializer(
            config, data=request.data, partial=True, context={"user": request.user}
        )
        serializer.is_valid(raise_exception=True)
        changed = any(getattr(config, field) != value for field, value in serializer.validated_data.items())
        if changed:
            for field, value in serializer.validated_data.items():
                setattr(config, field, value)
            config.revision = uuid.uuid4()
            config.anchor_at = timezone.now()
            config.schedule_timezone = str(user_zone(request.user))
            config.last_period_end = None
            config.save()
        return Response(config_response(config))


class DailyDigestPreviewEndpoint(BaseAPIView):
    def post(self, request):
        if request.data:
            return Response({"error": "Preview uses saved configuration and accepts no fields."}, status=400)
        config = DailyDigestConfig.objects.filter(user=request.user).first() or DailyDigestConfig(user=request.user)
        end = timezone.now()
        # Preview includes the current unsent interval and is safe while disabled.
        start = config.last_period_end or schedule_slot(config, end, previous=True)
        if config.pk and config.enabled:
            start = max(start, config.anchor_at)
        return Response(build_digest(config, start, end))
