# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only

import uuid
from collections import Counter, defaultdict
from datetime import timedelta

from django.db import IntegrityError, transaction
from django.utils import timezone
from django.utils.crypto import salted_hmac

from plane.db.models import Account, User
from plane.db.models.feishu import FeishuAdminBindingAudit, FeishuBinding, FeishuDirectoryPreview, FeishuOAuthState
from plane.utils.feishu_client import FeishuClient, FeishuError, get_feishu_config
from plane.utils.feishu_directory import FeishuDirectory
from plane.utils.notification_preferences import update_preferences


def fingerprint(config):
    return salted_hmac(
        "feishu-directory", f"{config.enabled}:{config.app_id}:{config.app_secret}", algorithm="sha256"
    ).hexdigest()


def eligible_users():
    return User.objects.filter(is_active=True, is_bot=False, masked_at__isnull=True)


def normalize(email):
    return (email or "").strip().lower()


def matches(members, app_id=None, tenant_key=None):
    identities = (
        list(Account.objects.filter(provider="oidc").values("user_id", "metadata")) if app_id and tenant_key else []
    )
    eligible_ids = {
        str(value) for value in eligible_users().filter(is_email_verified=True).values_list("pk", flat=True)
    }
    users = defaultdict(list)
    # Automatic matching requires verified email; an administrator's explicit
    # manual selection does not rely on ownership of the user's email address.
    for user in eligible_users().filter(is_email_verified=True).only("id", "email"):
        if normalize(user.email):
            users[normalize(user.email)].append(str(user.pk))
    counts = Counter(normalize(member["email"]) for member in members if normalize(member["email"]))
    rows = []
    for member in members:
        email = normalize(member["email"])
        candidates = users.get(email, [])
        unique = bool(email) and counts[email] == 1 and len(candidates) == 1
        target, basis = (candidates[0], "email") if unique else (None, "unmatched")
        linked = set()
        conflict = False
        for account in identities:
            identity = (account["metadata"] or {}).get("feishu_identity", {})
            if (
                not isinstance(identity, dict)
                or identity.get("endpoint") != "https://open.feishu.cn/open-apis/authen/v1/user_info"
            ):
                continue
            same_open = identity.get("client_id") == app_id and identity.get("open_id") == member["open_id"]
            same_union = bool(member.get("union_id")) and identity.get("union_id") == member.get("union_id")
            if not (same_open or same_union):
                continue
            if identity.get("tenant_key") != tenant_key:
                conflict = True
            linked.add(str(account["user_id"]))
        if linked or conflict:
            if conflict or len(linked) != 1 or not linked.issubset(eligible_ids):
                target, basis = None, "identity_conflict"
            else:
                target, basis = next(iter(linked)), "oidc"
        rows.append({**member, "id": str(uuid.uuid4()), "user_id": target, "match_basis": basis, "result": None})
    return rows


def directory_rows(members, app_id, tenant_key, mode):
    suggestions = members if all("match_basis" in m for m in members) else matches(members, app_id, tenant_key)
    bindings = {str(b.user_id): b for b in FeishuBinding.objects.all()}
    occupied = {b.open_id for b in bindings.values() if b.app_id == app_id and b.tenant_key == tenant_key}
    by_user = defaultdict(list)
    for member in suggestions:
        if member["user_id"] and member["open_id"] not in occupied:
            by_user[member["user_id"]].append(member)
    users = eligible_users()
    if mode == "all":
        from django.db.models import Q

        users = User.objects.filter(Q(pk__in=users.values("pk")) | Q(feishu_binding__isnull=False))
    else:
        users = users.filter(feishu_binding__isnull=True)
    rows = []
    for user in users.order_by("email", "id"):
        user_id = str(user.pk)
        binding = bindings.get(user_id)
        candidates = by_user[user_id]
        oidc = [m for m in candidates if m["match_basis"] == "oidc"]
        candidates = oidc or candidates
        member = candidates[0] if len(candidates) == 1 else None
        rows.append(
            {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "name": user.display_name,
                "email": user.email,
                "member_id": member["id"] if member else None,
                "match_basis": member["match_basis"] if member else "unmatched",
                "binding_id": str(binding.pk) if binding else None,
                "binding_name": binding.display_name if binding else "",
                "result": "already_bound" if binding else None,
            }
        )
    return rows


def create_preview(administrator, mode="unbound"):
    if mode not in ("unbound", "all"):
        raise FeishuError("invalid_mode")
    config = get_feishu_config()
    if not config.enabled:
        raise FeishuError("feishu_disabled")
    # Minimize retention of directory PII. Audit records remain independent of row content.
    FeishuDirectoryPreview.objects.filter(expires_at__lte=timezone.now()).update(rows=[], members=[])
    preview = FeishuDirectoryPreview.objects.create(
        administrator=administrator,
        mode=mode,
        config_digest=fingerprint(config),
        app_id=config.app_id,
        expires_at=timezone.now() + timedelta(minutes=15),
    )
    try:
        tenant, members = FeishuDirectory(FeishuClient(config)).collect()
        if fingerprint(get_feishu_config()) != preview.config_digest:
            raise FeishuError("configuration_changed")
        preview.tenant_key = tenant
        preview.members = matches(members, config.app_id, tenant)
        preview.rows = directory_rows(preview.members, config.app_id, tenant, mode)
        preview.status = "complete"
    except FeishuError as exc:
        preview.error = exc.reason
    preview.save()
    return preview


def preview_data(preview):
    expired = preview.expires_at <= timezone.now()
    occupied = set(
        FeishuBinding.objects.filter(app_id=preview.app_id, tenant_key=preview.tenant_key).values_list(
            "open_id", flat=True
        )
    )
    targets = (
        {
            str(user["id"]): user
            for user in User.objects.filter(pk__in=[row["user_id"] for row in preview.rows if row["user_id"]]).values(
                "id", "email", "display_name"
            )
        }
        if not expired
        else {}
    )
    return {
        "id": str(preview.pk),
        "mode": preview.mode,
        "status": "expired" if expired else preview.status,
        "error": preview.error,
        "expires_at": preview.expires_at,
        "members": []
        if expired
        else [
            {k: v for k, v in member.items() if k not in ("open_id", "union_id")}
            for member in preview.members
            if member["match_basis"] != "identity_conflict" and member["open_id"] not in occupied
        ],
        "rows": []
        if expired
        else [
            {
                **{key: value for key, value in row.items() if key not in ("open_id", "union_id")},
                "matched_user": targets.get(row["user_id"]),
            }
            for row in preview.rows
        ],
    }


def bind_preview(administrator, preview_id, selections, enable_notifications):
    # Revalidate selected provider identities before acquiring database locks.
    snapshot = FeishuDirectoryPreview.objects.filter(pk=preview_id, administrator=administrator).first()
    if not snapshot:
        raise FeishuError("preview_not_found")
    if snapshot.expires_at <= timezone.now():
        raise FeishuError("preview_expired")
    if snapshot.status != "complete":
        raise FeishuError("preview_incomplete")
    config = get_feishu_config()
    if not config.enabled or fingerprint(config) != snapshot.config_digest:
        raise FeishuError("configuration_changed")
    if not 1 <= len(selections) <= 20:
        raise FeishuError("invalid_selection")
    selected_ids = {item["row_id"] for item in selections}
    selected_rows = [row for row in snapshot.rows if row["id"] in selected_ids]
    if len(selected_rows) != len(selections):
        raise FeishuError("invalid_selection")
    completed = {
        str(value)
        for value in FeishuAdminBindingAudit.objects.filter(preview=snapshot).values_list("row_id", flat=True)
    }
    fresh = {}
    if selected_ids - completed:
        tenant, members = FeishuDirectory(FeishuClient(config)).collect()
        if tenant != snapshot.tenant_key:
            raise FeishuError("configuration_changed")
        fresh = {member["open_id"]: member for member in members}
    with transaction.atomic():
        preview = (
            FeishuDirectoryPreview.objects.select_for_update()
            .filter(pk=preview_id, administrator=administrator)
            .first()
        )
        if not preview:
            raise FeishuError("preview_not_found")
        if preview.expires_at <= timezone.now():
            raise FeishuError("preview_expired")
        if any("member_id" not in row for row in preview.rows):
            raise FeishuError("preview_expired")
        if preview.status != "complete":
            raise FeishuError("preview_incomplete")
        config = get_feishu_config()
        if not config.enabled or fingerprint(config) != preview.config_digest:
            raise FeishuError("configuration_changed")
        plane_rows = {row["id"]: row for row in preview.rows}
        members = {member["id"]: member for member in preview.members}
        rows = {}
        for item in selections:
            source = plane_rows.get(item["row_id"])
            if not source or source.get("binding_id") or item.get("user_id"):
                raise FeishuError("invalid_selection")
            member_id = item.get("member_id") or source.get("member_id")
            member = members.get(member_id)
            if not member or (source["match_basis"] == "oidc" and member_id != source["member_id"]):
                raise FeishuError("invalid_selection")
            rows[source["id"]] = {
                **member,
                "id": source["id"],
                "user_id": source["user_id"],
                "match_basis": source["match_basis"] if member_id == source["member_id"] else "unmatched",
                "result": source["result"],
            }
        if len({r["open_id"] for r in rows.values()}) != len(selections):
            raise FeishuError("invalid_selection")
        if any(item["row_id"] not in rows for item in selections):
            raise FeishuError("invalid_selection")
        if len({item["row_id"] for item in selections}) != len(selections):
            raise FeishuError("invalid_selection")
        # A stable lock order also serializes overlapping administrator batches.
        targets = {}
        for item in selections:
            row = rows[item["row_id"]]
            target = item.get("user_id") or row["user_id"]
            if (
                row["match_basis"] == "identity_conflict"
                or row["result"] in ("already_bound", "conflict")
                or not target
                or (row["match_basis"] == "oidc" and target != row["user_id"])
            ):
                raise FeishuError("invalid_selection")
            targets[row["id"]] = target
        locked = {
            str(user.pk): user
            for user in User.objects.select_for_update().filter(pk__in=targets.values()).order_by("pk")
        }
        # Re-evaluate automatic matches against current verified identities.
        current_matches = {
            row["open_id"]: row for row in matches(list(fresh.values()), preview.app_id, preview.tenant_key)
        }
        for item in selections:
            row = rows[item["row_id"]]
            target = targets[row["id"]]
            audit = FeishuAdminBindingAudit.objects.filter(preview=preview, row_id=row["id"]).first()
            if audit:
                if str(audit.user_id) != target:
                    raise FeishuError("invalid_selection")
                row["result"] = "bound"
                continue
            member = fresh.get(row["open_id"])
            if (
                not member
                or normalize(member["email"]) != normalize(row["email"])
                or member.get("union_id", "") != row.get("union_id", "")
            ):
                row["result"] = "match_changed"
                continue
            user = locked.get(target)
            if not user or not eligible_users().filter(pk=user.pk).exists():
                row["result"] = "user_ineligible"
                continue
            current_match = current_matches[row["open_id"]]
            oidc_targets = [
                m["open_id"] for m in current_matches.values() if m["match_basis"] == "oidc" and m["user_id"] == target
            ]
            if oidc_targets and oidc_targets != [row["open_id"]]:
                row["result"] = "match_changed"
                continue
            manual = row["match_basis"] == "unmatched" or target != row["user_id"]
            if (
                current_match["match_basis"] == "identity_conflict"
                or (current_match["match_basis"] == "oidc" and current_match["user_id"] != target)
                or (
                    not manual
                    and (current_match["user_id"] != target or current_match["match_basis"] != row["match_basis"])
                )
            ):
                row["result"] = "match_changed"
                continue
            try:
                with transaction.atomic():
                    if (
                        FeishuBinding.objects.filter(user=user).exists()
                        or FeishuBinding.objects.filter(
                            app_id=config.app_id, tenant_key=preview.tenant_key, open_id=row["open_id"]
                        ).exists()
                    ):
                        row["result"] = "conflict"
                        continue
                    # Invalidate even consumed states: an OAuth network call may be in flight.
                    FeishuOAuthState.objects.filter(user=user).delete()
                    binding = FeishuBinding.objects.create(
                        user=user,
                        app_id=config.app_id,
                        tenant_key=preview.tenant_key,
                        open_id=row["open_id"],
                        display_name=row["name"],
                    )
                    if enable_notifications:
                        update_preferences(user, None, None, {"channels": {"feishu": True}})
                    FeishuAdminBindingAudit.objects.create(
                        preview=preview,
                        row_id=row["id"],
                        administrator=administrator,
                        user=user,
                        binding=binding,
                        match_basis="manual" if manual else row["match_basis"],
                        notifications_enabled=enable_notifications,
                    )
                    row["result"] = "bound"
            except IntegrityError:
                row["result"] = "conflict"
        for row_id, row in rows.items():
            plane_rows[row_id]["result"] = row["result"]
        preview.save(update_fields=["rows"])
        return preview


def unbind_preview(administrator, preview_id, row_id):
    from plane.utils.feishu import unbind_feishu

    with transaction.atomic():
        preview = (
            FeishuDirectoryPreview.objects.select_for_update()
            .filter(pk=preview_id, administrator=administrator)
            .first()
        )
        if not preview:
            raise FeishuError("preview_not_found")
        if preview.expires_at <= timezone.now():
            raise FeishuError("preview_expired")
        if preview.status != "complete":
            raise FeishuError("preview_incomplete")
        config = get_feishu_config()
        if not config.enabled or fingerprint(config) != preview.config_digest:
            raise FeishuError("configuration_changed")
        row = next((r for r in preview.rows if r["id"] == str(row_id)), None)
        if not row or not row.get("binding_id"):
            raise FeishuError("invalid_selection")
        user = User.objects.select_for_update().get(pk=row["user_id"])
        binding = FeishuBinding.objects.select_for_update().filter(user=user).first()
        audit = FeishuAdminBindingAudit.objects.filter(preview=preview, row_id=row_id).first()
        if audit and audit.source == "admin_unbind":
            return
        if not binding or str(binding.pk) != row["binding_id"]:
            raise FeishuError("binding_changed")
        FeishuAdminBindingAudit.objects.create(
            preview=preview,
            row_id=row_id,
            administrator=administrator,
            user=user,
            binding=binding,
            source="admin_unbind",
            match_basis="manual",
        )
        unbind_feishu(user.pk)
