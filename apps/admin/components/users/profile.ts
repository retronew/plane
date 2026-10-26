/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { IInstanceAdmin, IInstanceUser, TInstanceUserProfile } from "@plane/types";

export const PROFILE_FIELDS = ["first_name", "last_name", "display_name"] as const;

export function profileValues(user: TInstanceUserProfile): TInstanceUserProfile {
  return { first_name: user.first_name, last_name: user.last_name, display_name: user.display_name };
}

export function normalizeProfile(profile: TInstanceUserProfile): TInstanceUserProfile {
  return {
    first_name: profile.first_name.trim(),
    last_name: profile.last_name.trim(),
    display_name: profile.display_name.trim(),
  };
}

export function validateProfileName(value: string, required: boolean): "required" | "too_long" | "url" | undefined {
  const trimmed = value.trim();
  if (required && !trimmed) return "required";
  if ([...trimmed].length > 255) return "too_long";
  if (
    !required &&
    /(?:https?:\/\/\S+|www\.[a-z\d]|(?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)+[a-z]{2,6}|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?))/i.test(
      trimmed
    )
  )
    return "url";
  return undefined;
}

export function isInstanceUserCacheKey(key: unknown): boolean {
  const namespace = Array.isArray(key) ? key[0] : key;
  return namespace === "INSTANCE_USERS" || namespace === "INSTANCE_USER";
}

export type AccountAction = "activate" | "deactivate" | "promote" | "revoke";

export function allowedAccountActions(
  user: IInstanceUser,
  currentUserId: string | undefined,
  admins: IInstanceAdmin[] | undefined
): AccountAction[] {
  const actions: AccountAction[] = [];
  if (!user.is_active) actions.push("activate");
  if (user.is_active && !user.is_instance_admin) actions.push("promote");
  if (user.id !== currentUserId && currentUserId) {
    if (user.is_active && !user.is_instance_admin) actions.push("deactivate");
    if (
      user.is_active &&
      user.is_instance_admin &&
      admins &&
      admins.length > 1 &&
      admins.some((admin) => admin.user === user.id)
    )
      actions.push("revoke");
  }
  return actions;
}

// Values stored in last_login_medium; anything else is shown as-is
export const LOGIN_MEDIUM_KEYS: Record<string, string> = {
  oidc: "admin.users.login_medium.oidc",
  email: "admin.users.login_medium.email",
  "magic-code": "admin.users.login_medium.magic_code",
  google: "Google",
  github: "GitHub",
  gitlab: "GitLab",
  gitea: "Gitea",
};
