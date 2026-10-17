/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { IUserLite } from "@plane/types";

export const overviewTranslationKey = "web.project_overview";

export function overviewActorName(user: IUserLite | null, unknownUser: string): string {
  return user?.display_name || [user?.first_name, user?.last_name].filter(Boolean).join(" ") || unknownUser;
}

/** Snapshots are JSON data, never HTML. Keep unresolved IDs verbatim rather than guessing a label. */
export function activityValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.length ? value.map(activityValue).join(", ") : "[]";
  if (typeof value === "object") {
    const snapshot = value as Record<string, unknown>;
    for (const key of ["title", "body", "name", "reaction"]) {
      if (typeof snapshot[key] === "string" && snapshot[key]) return snapshot[key];
    }
    if (snapshot.attributes && typeof snapshot.attributes === "object") {
      const name = (snapshot.attributes as Record<string, unknown>).name;
      if (typeof name === "string" && name) return name;
    }
    return JSON.stringify(value);
  }
  return String(value);
}

// Only translate known fields. An unrecognised field must retain its server-provided name.
export const activityFields = new Set([
  "name",
  "description",
  "status",
  "priority",
  "project_lead",
  "default_assignee",
  "labels",
  "members",
  "start_date",
  "target_date",
  "cover_image",
  "cover_image_asset",
  "logo_props",
  "archived_at",
  "network",
  "identifier",
  "link",
  "update",
  "attachment",
  "reaction",
  "description_text",
  "description_html",
  "emoji",
  "icon_prop",
]);
