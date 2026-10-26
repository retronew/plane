/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import type { IInstanceAdmin, IInstanceUser } from "@plane/types";
import { allowedAccountActions, isInstanceUserCacheKey, normalizeProfile, validateProfileName } from "./profile";

const user: IInstanceUser = {
  id: "target",
  email: "target@example.com",
  first_name: "",
  last_name: "",
  display_name: "Target",
  avatar_url: null,
  is_active: true,
  is_instance_admin: false,
  has_sso: false,
  last_login_medium: null,
  last_login_time: null,
  workspace_count: 0,
  date_joined: "2026-01-01",
};
const admins = [
  { id: "admin-target", user: "target" },
  { id: "admin-self", user: "self" },
] as IInstanceAdmin[];

test("profile payload trims all fields and excludes read-only account data", () => {
  assert.deepEqual(
    normalizeProfile({ ...user, first_name: "  Ada ", last_name: " Lovelace ", display_name: " Ada " }),
    { first_name: "Ada", last_name: "Lovelace", display_name: "Ada" }
  );
});
test("blank names are allowed, display name is required, unicode length matches backend", () => {
  assert.equal(validateProfileName("  ", false), undefined);
  assert.equal(validateProfileName("  ", true), "required");
  assert.equal(validateProfileName("字".repeat(256), false), "too_long");
  assert.equal(validateProfileName("𠮷".repeat(255), true), undefined);
});
test("reject URLs in names including bare domains and IPs", () => {
  for (const value of ["https://example.com", "www.example.com", "example.com", "127.0.0.1"])
    assert.equal(validateProfileName(value, false), "url");
  assert.equal(validateProfileName("Ada Lovelace", false), undefined);
});
test("self protection and unknown identity never allow deactivation or revocation", () => {
  assert.deepEqual(allowedAccountActions(user, "target", admins), ["promote"]);
  assert.deepEqual(allowedAccountActions({ ...user, is_instance_admin: true }, "target", admins), []);
  assert.deepEqual(allowedAccountActions(user, undefined, admins), ["promote"]);
});
test("admin requires revocation before deactivation and last admin is protected", () => {
  const admin = { ...user, is_instance_admin: true };
  assert.deepEqual(allowedAccountActions(admin, "self", admins), ["revoke"]);
  assert.deepEqual(allowedAccountActions(admin, "self", admins.slice(0, 1)), []);
  assert.deepEqual(allowedAccountActions(admin, "self", undefined), []);
});
test("inactive users must be reactivated before changing their role", () => {
  assert.deepEqual(allowedAccountActions({ ...user, is_active: false }, "self", admins), ["activate"]);
  assert.deepEqual(allowedAccountActions({ ...user, is_active: false, is_instance_admin: true }, "self", admins), [
    "activate",
  ]);
  assert.deepEqual(allowedAccountActions(user, "self", admins), ["promote", "deactivate"]);
});

test("refresh targets all user list filters and user details without unrelated caches", () => {
  for (const key of ["INSTANCE_USERS", ["INSTANCE_USERS", "query", "active"], ["INSTANCE_USER", "target"]])
    assert.equal(isInstanceUserCacheKey(key), true);
  for (const key of ["INSTANCE_ADMINS", ["OTHER", "INSTANCE_USER"], null, undefined])
    assert.equal(isInstanceUserCacheKey(key), false);
});
