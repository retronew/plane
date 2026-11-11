import logging

from plane.services.workspace_sync import RequestInvalidations, request_invalidations, request_invalidation

logger = logging.getLogger(__name__)


class WorkspaceSyncInvalidationMiddleware:
    """Fallback for successful bulk/custom writes, scoped by trusted resolver kwargs."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.method not in {"POST", "PUT", "PATCH", "DELETE"}:
            return self.get_response(request)
        batch = RequestInvalidations()
        token = request_invalidations.set(batch)
        accepted = False
        try:
            response = self.get_response(request)
            accepted = 200 <= response.status_code < 300
            match = request.resolver_match
            if accepted and match and request.path.startswith("/api/workspaces/"):
                try:
                    request_invalidation(match.kwargs)
                except Exception:
                    logger.warning("Workspace sync request fallback failed", exc_info=True)
            return response
        finally:
            request_invalidations.reset(token)
            batch.finish(accepted)
