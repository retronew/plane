"""One-shot SSRF-safe HTTP in a disposable process with a parent-owned deadline.

This module deliberately imports no Django models/settings. Spawn receives only JSON
bytes, and raw response bytes cross a bounded, framed pipe, never a pickle payload.
"""

import base64
import json
import multiprocessing
from multiprocessing.shared_memory import SharedMemory
import os
import time
from urllib.parse import urlsplit

MAX_BODY_BYTES = 64 * 1024
MAX_INPUT_BYTES = 256 * 1024
MAX_RESULT_BYTES = 96 * 1024
FRAME_BYTES = 1024
HTTP_TIMEOUT = 5


class WorkflowHTTPTransportError(Exception):
    def __init__(self):
        super().__init__("Workflow HTTP outcome is unknown.")


def _fetch(request):
    from plane.utils.url_security import pinned_fetch

    response = None
    try:
        body = request.get("body")
        kwargs = {"data": body} if isinstance(body, str) else {"json": body}
        response = pinned_fetch(
            request["method"],
            request["url"],
            headers=request["headers"],
            timeout=HTTP_TIMEOUT,
            stream=True,
            max_attempts=1,
            **kwargs,
        )
        data = bytearray()
        if not 300 <= response.status_code < 400:
            for chunk in response.iter_content(chunk_size=4096):
                data.extend(chunk[: MAX_BODY_BYTES - len(data)])
                if len(data) >= MAX_BODY_BYTES:
                    break
        return {"status": response.status_code, "body": base64.b64encode(data).decode("ascii")}
    finally:
        if response is not None:
            response.close()


def _worker(send, payload):
    # A dependency's diagnostic or unhandled error must not print URLs/secrets.
    with open(os.devnull, "w") as sink:
        os.dup2(sink.fileno(), 1)
        os.dup2(sink.fileno(), 2)
    try:
        request = json.loads(payload)
        if request.get("validate_only"):
            from plane.utils.ip_address import resolve_and_validate

            resolve_and_validate(urlsplit(request["url"]).hostname)
            result = {"validated": True}
        else:
            result = _fetch(request)
        encoded = json.dumps(result, separators=(",", ":"), allow_nan=False).encode("utf-8")
        if len(encoded) > MAX_RESULT_BYTES:
            raise WorkflowHTTPTransportError()
    except BaseException:
        encoded = b'{"error":"HTTP_OUTCOME_UNKNOWN"}'
    try:
        # Each frame (including its four-byte pipe header) fits POSIX PIPE_BUF.
        # Parent polls between frames rather than blocking on a large recv_bytes.
        for offset in range(0, len(encoded), FRAME_BYTES):
            send.send_bytes(encoded[offset : offset + FRAME_BYTES])
        send.send_bytes(b"")
    except (OSError, EOFError):
        pass
    finally:
        send.close()


def _spawn_worker(send, payload_name, payload_size):
    payload_memory = SharedMemory(name=payload_name)
    try:
        payload = bytes(payload_memory.buf[:payload_size])
    finally:
        payload_memory.close()
    _worker(send, payload)


def _dispose(process, started):
    if not started:
        process.close()
        return
    if process.is_alive():
        process.terminate()
    process.join(timeout=0.2)
    if process.is_alive():
        process.kill()
        process.join(timeout=0.2)
    if not process.is_alive():
        process.close()


def bounded_http(request, *, validate_only=False):
    """Return (status, body bytes), or a sanitized error, within a hard deadline.

    Spawn is mandatory: fork would inherit the Django worker's DB sockets and locks.
    The parent deadline includes child imports, DNS, TLS, headers and streaming.
    A timed out child is terminated/killed and reaped; it is never retried.
    """
    # SDK RPC runs in an HTTP worker. Celery prefork daemons cannot spawn
    # children; direct use there must fail closed without touching the network.
    if multiprocessing.current_process().daemon:
        raise WorkflowHTTPTransportError()
    payload = json.dumps(
        {
            "url": request["url"],
            "method": request["method"],
            "headers": request["headers"],
            "body": request.get("body"),
            "validate_only": validate_only,
        },
        separators=(",", ":"),
        allow_nan=False,
    ).encode("utf-8")
    if len(payload) > MAX_INPUT_BYTES:
        raise WorkflowHTTPTransportError()
    context = multiprocessing.get_context("spawn")
    receive, send = context.Pipe(duplex=False)
    # Never send a large payload through multiprocessing's startup pipe: start()
    # could otherwise block before the parent's polling deadline even begins.
    payload_memory = SharedMemory(create=True, size=len(payload))
    process = None
    started = False
    deadline = time.monotonic() + HTTP_TIMEOUT
    try:
        payload_memory.buf[: len(payload)] = payload
        process = context.Process(target=_spawn_worker, args=(send, payload_memory.name, len(payload)), daemon=True)
        process.start()
        started = True
        send.close()
        data = bytearray()
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0 or not receive.poll(remaining):
                raise WorkflowHTTPTransportError()
            frame = receive.recv_bytes(FRAME_BYTES)
            if time.monotonic() >= deadline:
                raise WorkflowHTTPTransportError()
            if not frame:
                break
            data.extend(frame)
            if len(data) > MAX_RESULT_BYTES:
                raise WorkflowHTTPTransportError()
        result = json.loads(data)
        if validate_only:
            if result != {"validated": True}:
                raise WorkflowHTTPTransportError()
            return None
        if not isinstance(result, dict) or set(result) != {"status", "body"}:
            raise WorkflowHTTPTransportError()
        status = result["status"]
        if isinstance(status, bool) or not isinstance(status, int) or not 100 <= status <= 599:
            raise WorkflowHTTPTransportError()
        body = base64.b64decode(result["body"], validate=True)
        if len(body) > MAX_BODY_BYTES:
            raise WorkflowHTTPTransportError()
        return status, body
    except Exception:
        raise WorkflowHTTPTransportError() from None
    finally:
        receive.close()
        send.close()
        try:
            if process is not None:
                _dispose(process, started)
        finally:
            payload_memory.close()
            payload_memory.unlink()
