# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import os

from channels.routing import ProtocolTypeRouter
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "plane.settings.production")
# Initialize Django ASGI application once after settings are configured.
django_asgi_app = get_asgi_application()

application = ProtocolTypeRouter({"http": django_asgi_app})
