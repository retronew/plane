# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only

import base64
import hashlib
import json
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

import pytest
from cryptography.hazmat.primitives import padding
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from django.core import signing

from plane.utils.feishu_card_security import (
    ACTION_TOKEN_SALT,
    MAX_BODY_BYTES,
    FeishuCardSecurityError,
    action_token,
    read_action_token,
    read_callback,
)
from plane.utils.feishu_client import FeishuCallbackConfig

pytestmark = pytest.mark.unit
CONFIG = FeishuCallbackConfig("verification-secret", "encrypt-secret")
NOW = 1800000000


def encrypt_body(body, key=CONFIG.encrypt_key):
    iv = bytes(range(16))
    padder = padding.PKCS7(128).padder()
    padded = padder.update(json.dumps(body).encode()) + padder.finalize()
    encryptor = Cipher(algorithms.AES(hashlib.sha256(key.encode()).digest()), modes.CBC(iv)).encryptor()
    packed = iv + encryptor.update(padded) + encryptor.finalize()
    return json.dumps({"encrypt": base64.b64encode(packed).decode()}).encode()


def signed_headers(raw, timestamp=NOW, nonce="nonce", key=CONFIG.encrypt_key):
    timestamp = str(timestamp)
    return {
        "X-Lark-Request-Timestamp": timestamp,
        "X-Lark-Request-Nonce": nonce,
        "X-Lark-Signature": hashlib.sha256((timestamp + nonce + key).encode() + raw).hexdigest(),
    }


def event_body():
    return {
        "schema": "2.0",
        "header": {
            "event_id": "event",
            "token": CONFIG.verification_token,
            "event_type": "card.action.trigger",
            "app_id": "app",
            "tenant_key": "tenant",
        },
        "event": {
            "operator": {"open_id": "open", "tenant_key": "tenant"},
            "host": "im_message",
            "context": {"open_message_id": "message", "open_chat_id": "chat"},
            "action": {"tag": "button", "value": {"token": "row-token"}},
        },
    }


def read(raw, headers, config=CONFIG):
    with patch("plane.utils.feishu_card_security.time.time", return_value=NOW):
        return read_callback(raw, headers, config)


def test_action_token_is_compact_and_only_signs_uuid():
    action = SimpleNamespace(pk=uuid4(), payload={"secret": "never-serialized"})
    token = action_token(action)
    assert len(token) == 80
    assert token.startswith(str(action.pk) + ":")
    assert read_action_token(token) == action.pk
    assert "secret" not in token


@pytest.mark.parametrize("token", [None, {}, "", "x" * 129, "unsigned"])
def test_invalid_action_tokens_are_safe(token):
    with pytest.raises(FeishuCardSecurityError, match="^invalid_feishu_callback$"):
        read_action_token(token)


def test_token_rejects_tampering_wrong_salt_and_non_uuid():
    action = SimpleNamespace(pk=uuid4())
    original = action_token(action)
    for token in (
        str(uuid4()) + original[36:],
        signing.Signer(salt="other-purpose").sign(str(action.pk)),
        signing.Signer(salt=ACTION_TOKEN_SALT).sign("not-a-uuid"),
    ):
        with pytest.raises(FeishuCardSecurityError):
            read_action_token(token)


def test_official_encryption_and_signature_roundtrip():
    body = event_body()
    raw = encrypt_body(body)
    assert read(raw, signed_headers(raw)) == body


@pytest.mark.parametrize("encrypted", [False, True])
def test_unsigned_challenge_uses_top_level_token(encrypted):
    body = {"type": "url_verification", "token": CONFIG.verification_token, "challenge": "challenge-value"}
    raw = encrypt_body(body) if encrypted else json.dumps(body).encode()
    assert read(raw, {})["challenge"] == "challenge-value"
    body["token"] = "wrong"
    raw = encrypt_body(body) if encrypted else json.dumps(body).encode()
    with pytest.raises(FeishuCardSecurityError):
        read(raw, {})


def test_plaintext_challenge_works_before_encrypt_key_is_configured():
    raw = json.dumps({"type": "url_verification", "token": "token", "challenge": "challenge"}).encode()
    assert read(raw, {}, FeishuCallbackConfig("token", ""))["challenge"] == "challenge"


@pytest.mark.parametrize("offset,accepted", [(-301, False), (301, False), (-300, True), (300, True)])
def test_signature_five_minute_window(offset, accepted):
    raw = encrypt_body(event_body())
    headers = signed_headers(raw, NOW + offset)
    if accepted:
        assert read(raw, headers)["schema"] == "2.0"
    else:
        with pytest.raises(FeishuCardSecurityError):
            read(raw, headers)


@pytest.mark.parametrize(
    "header,value",
    [
        ("X-Lark-Request-Timestamp", "invalid"),
        ("X-Lark-Request-Timestamp", "9" * 13),
        ("X-Lark-Request-Nonce", ""),
        ("X-Lark-Request-Nonce", "n" * 257),
        ("X-Lark-Signature", "0" * 64),
        ("X-Lark-Signature", "é" * 64),
    ],
)
def test_invalid_signature_headers(header, value):
    raw = encrypt_body(event_body())
    headers = signed_headers(raw)
    headers[header] = value
    with pytest.raises(FeishuCardSecurityError):
        read(raw, headers)


def test_signature_covers_exact_raw_bytes():
    raw = encrypt_body(event_body())
    with pytest.raises(FeishuCardSecurityError):
        read(raw + b" ", signed_headers(raw))


@pytest.mark.parametrize("encrypted,signed", [(False, False), (False, True), (True, False)])
def test_ordinary_events_require_encryption_and_signature(encrypted, signed):
    raw = encrypt_body(event_body()) if encrypted else json.dumps(event_body()).encode()
    with pytest.raises(FeishuCardSecurityError):
        read(raw, signed_headers(raw) if signed else {})


@pytest.mark.parametrize("config", [FeishuCallbackConfig("", "key"), FeishuCallbackConfig("token", "")])
def test_incomplete_config_cannot_enable_interactions(config):
    raw = encrypt_body(event_body())
    with pytest.raises(FeishuCardSecurityError):
        read(raw, signed_headers(raw), config)


@pytest.mark.parametrize("encrypted", ["!!!", "a", base64.b64encode(b"short").decode(), "é", {}])
def test_invalid_ciphertext_is_safe(encrypted):
    raw = json.dumps({"encrypt": encrypted}).encode()
    with pytest.raises(FeishuCardSecurityError, match="^invalid_feishu_callback$"):
        read(raw, signed_headers(raw))


def test_wrong_encryption_key_and_padding_are_rejected():
    raw = encrypt_body(event_body(), key="wrong-key")
    with pytest.raises(FeishuCardSecurityError):
        read(raw, signed_headers(raw))
    envelope = json.loads(encrypt_body(event_body()))
    packed = bytearray(base64.b64decode(envelope["encrypt"]))
    packed[-17] ^= 255  # Corrupt the final plaintext padding byte deterministically.
    raw = json.dumps({"encrypt": base64.b64encode(packed).decode()}).encode()
    with pytest.raises(FeishuCardSecurityError):
        read(raw, signed_headers(raw))


@pytest.mark.parametrize("raw", [b"", b"[]", b"null", b"\xff", b"{", b"x" * (MAX_BODY_BYTES + 1)])
def test_body_limits_and_json_structure(raw):
    with pytest.raises(FeishuCardSecurityError):
        read(raw, {})


@pytest.mark.parametrize(
    "section,key,value",
    [
        (None, "schema", "1.0"),
        (None, "event", []),
        (None, "header", []),
        ("header", "token", "wrong"),
        ("header", "token", "x" * 257),
        ("header", "event_type", "other"),
        ("header", "app_id", {}),
        ("header", "tenant_key", ""),
        ("header", "event_id", ""),
        ("event", "host", "other"),
        ("event", "operator", []),
        ("event", "context", {}),
        ("event", "action", {"tag": "input", "value": {}}),
    ],
)
def test_event_structure_is_fail_closed(section, key, value):
    body = event_body()
    (body[section] if section else body)[key] = value
    raw = encrypt_body(body)
    with pytest.raises(FeishuCardSecurityError):
        read(raw, signed_headers(raw))


def test_bad_signature_is_not_ignored_for_challenge():
    raw = encrypt_body({"type": "url_verification", "token": CONFIG.verification_token, "challenge": "challenge"})
    headers = signed_headers(raw)
    headers["X-Lark-Signature"] = "0" * 64
    with pytest.raises(FeishuCardSecurityError):
        read(raw, headers)
