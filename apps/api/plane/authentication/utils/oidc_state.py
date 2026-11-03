# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only

import time
import uuid

from django.core.cache import cache

SESSION_KEY = "oidc_transactions"
TTL = 600


def start_oidc_transaction(request, *, host, next_path=None, purpose="login", audience="app", user_id=None):
    now = time.time()
    transactions = {
        key: value for key, value in request.session.get(SESSION_KEY, {}).items() if now - value.get("created", 0) < TTL
    }
    # Bound session size while allowing several tabs to sign in independently.
    transactions = dict(sorted(transactions.items(), key=lambda item: item[1]["created"])[-15:])
    state = uuid.uuid4().hex
    transactions[state] = {
        "created": now,
        "host": host,
        "next_path": next_path,
        "purpose": purpose,
        "audience": audience,
        "user_id": str(user_id) if user_id else None,
    }
    request.session[SESSION_KEY] = transactions
    return state


def consume_oidc_transaction(request, state, *, audience):
    if not isinstance(state, str) or len(state) != 32:
        return None
    transactions = dict(request.session.get(SESSION_KEY, {}))
    pending = transactions.pop(state, None)
    request.session[SESSION_KEY] = transactions
    if not pending or pending.get("audience") != audience or time.time() - pending.get("created", 0) >= TTL:
        return None
    # Session saves alone cannot prevent two simultaneous callbacks replaying a state.
    if not cache.add(f"oidc_state_consumed:{state}", True, timeout=TTL):
        return None
    return pending
