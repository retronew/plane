# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only

import base64
import binascii
import hashlib
import hmac
import json
import re
import time
from datetime import datetime
from uuid import UUID

from cryptography.hazmat.primitives import padding
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from django.core import signing

MAX_BODY_BYTES = 64 * 1024
ACTION_TOKEN_SALT = "plane.feishu.card-action.v1"
SIGNATURE_HEADERS = ("X-Lark-Request-Timestamp", "X-Lark-Request-Nonce", "X-Lark-Signature")


class FeishuCardSecurityError(Exception):
    """Fixed public error only: never include callback bodies or credentials."""

    def __init__(self, status=403, *, reason="invalid_callback"):
        self.status = status
        self.reason = reason
        super().__init__("invalid_feishu_callback")


def bounded_string(value, maximum=128):
    if not isinstance(value, str) or not 0 < len(value) <= maximum:
        return False
    try:
        value.encode("utf-8")
    except UnicodeEncodeError:
        return False
    return True


def action_token(action):
    # Only the row identifier is signed. The immutable business payload stays in the DB.
    return signing.Signer(salt=ACTION_TOKEN_SALT).sign(str(action.pk))


def read_action_token(token):
    if not bounded_string(token, 128):
        raise FeishuCardSecurityError()
    try:
        return UUID(signing.Signer(salt=ACTION_TOKEN_SALT).unsign(token))
    except (signing.BadSignature, ValueError):
        raise FeishuCardSecurityError() from None


def _json_object(raw):
    try:
        value = json.loads(raw)
    except (ValueError, UnicodeDecodeError, RecursionError):
        raise FeishuCardSecurityError(400) from None
    if not isinstance(value, dict):
        raise FeishuCardSecurityError(400)
    return value


def _same_token(actual, expected):
    return bounded_string(actual, 256) and hmac.compare_digest(actual.encode(), expected.encode())


def _timestamp_seconds(timestamp):
    if not bounded_string(timestamp, 128) or not timestamp.isascii():
        raise FeishuCardSecurityError(reason="invalid_signature_timestamp")
    if timestamp.isdecimal() and len(timestamp) <= 13:
        return int(timestamp) / 1000 if len(timestamp) == 13 else int(timestamp)
    # Feishu card callbacks can use Go time.Time.String(), including a monotonic
    # suffix. Only the wall clock and numeric timezone determine freshness.
    match = re.fullmatch(
        r"(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))? "
        r"([+-]\d{4}) [A-Za-z0-9+-]{1,16}(?: m=[+-]\d{1,20}\.\d{1,9})?",
        timestamp,
    )
    if match:
        try:
            value = datetime.strptime(f"{match[1]} {match[3]}", "%Y-%m-%d %H:%M:%S %z")
            return value.timestamp() + (int(match[2]) / 10 ** len(match[2]) if match[2] else 0)
        except ValueError:
            pass
    raise FeishuCardSecurityError(reason="invalid_signature_timestamp")


def _verify_signature(raw, headers, encrypt_key):
    timestamp, nonce, signature = (headers.get(name) for name in SIGNATURE_HEADERS)
    if any(value is None for value in (timestamp, nonce, signature)):
        raise FeishuCardSecurityError(reason="missing_signature_header")
    timestamp_seconds = _timestamp_seconds(timestamp)
    if not bounded_string(nonce, 256):
        raise FeishuCardSecurityError(reason="invalid_signature_nonce")
    if not bounded_string(signature, 64) or not re.fullmatch(r"[0-9a-f]{64}", signature):
        raise FeishuCardSecurityError(reason="invalid_signature_format")
    if abs(time.time() - timestamp_seconds) > 300:
        raise FeishuCardSecurityError(reason="signature_timestamp_out_of_window")
    expected = hashlib.sha256((timestamp + nonce + encrypt_key).encode() + raw).hexdigest()
    if not hmac.compare_digest(signature, expected):
        raise FeishuCardSecurityError(reason="signature_mismatch")


def _decrypt(encrypted, encrypt_key):
    if not encrypt_key or not bounded_string(encrypted, MAX_BODY_BYTES):
        raise FeishuCardSecurityError()
    try:
        packed = base64.b64decode(encrypted, validate=True)
        if len(packed) < 32 or len(packed) % 16:
            raise ValueError
        decryptor = Cipher(
            algorithms.AES(hashlib.sha256(encrypt_key.encode()).digest()), modes.CBC(packed[:16])
        ).decryptor()
        padded = decryptor.update(packed[16:]) + decryptor.finalize()
        unpadder = padding.PKCS7(128).unpadder()
        plaintext = unpadder.update(padded) + unpadder.finalize()
    except (ValueError, binascii.Error):
        raise FeishuCardSecurityError() from None
    return _json_object(plaintext)


def read_callback(raw, headers, config):
    """Verify Feishu v2 events; URL verification alone may omit signature headers."""
    if not raw or len(raw) > MAX_BODY_BYTES:
        raise FeishuCardSecurityError(400)
    if not config.verification_token:
        raise FeishuCardSecurityError()
    envelope = _json_object(raw)
    has_signature = any(name in headers for name in SIGNATURE_HEADERS)
    if has_signature:
        if not config.encrypt_key:
            raise FeishuCardSecurityError()
        _verify_signature(raw, headers, config.encrypt_key)
    encrypted = "encrypt" in envelope
    body = _decrypt(envelope["encrypt"], config.encrypt_key) if encrypted else envelope
    if body.get("type") == "url_verification":
        if not _same_token(body.get("token"), config.verification_token):
            raise FeishuCardSecurityError()
        if not bounded_string(body.get("challenge"), 4096):
            raise FeishuCardSecurityError(400)
        return body
    if not config.encrypt_key or not has_signature:
        raise FeishuCardSecurityError(reason="missing_signature")
    header, event = body.get("header"), body.get("event")
    if body.get("schema") != "2.0" or not isinstance(header, dict) or not isinstance(event, dict):
        raise FeishuCardSecurityError(400, reason="invalid_event_structure")
    # Match Feishu's Python SDK: signed callbacks may be plaintext and omit the legacy
    # verification token. A supplied token must still match; signature is mandatory.
    if "token" in header and not _same_token(header["token"], config.verification_token):
        raise FeishuCardSecurityError(reason="verification_token_mismatch")
    if header.get("event_type") != "card.action.trigger" or event.get("host") != "im_message":
        raise FeishuCardSecurityError(400)
    if any(not bounded_string(header.get(key)) for key in ("event_id", "app_id", "tenant_key")):
        raise FeishuCardSecurityError(400)
    operator, context, action = event.get("operator"), event.get("context"), event.get("action")
    if not all(isinstance(value, dict) for value in (operator, context, action)):
        raise FeishuCardSecurityError(400)
    if (
        any(not bounded_string(operator.get(key)) for key in ("open_id", "tenant_key"))
        or any(not bounded_string(context.get(key)) for key in ("open_message_id", "open_chat_id"))
        or not isinstance(action.get("value"), dict)
        or action.get("tag") not in ("button", "select_static")
    ):
        raise FeishuCardSecurityError(400)
    return body
