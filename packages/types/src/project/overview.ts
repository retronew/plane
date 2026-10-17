/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { IUserLite } from "../users";

export type TProjectOverviewLink = {
  id: string;
  title: string;
  url: string;
  project: string;
  created_by: string | null;
  created_at: string;
};
export type TProjectOverviewAttachment = {
  id: string;
  attributes: { name: string; size: number; type: string };
  asset_url: string;
  created_by: string | null;
  created_at: string;
};
export type TProjectOverviewReaction = {
  id: string;
  reaction: string;
  actor: string;
  actor_detail: IUserLite | null;
};
export type TProjectUpdateHealth = "on_track" | "at_risk" | "off_track";
export type TProjectOverviewUpdate = {
  id: string;
  body: string;
  health: TProjectUpdateHealth;
  created_by: string | null;
  created_by_detail: IUserLite | null;
  created_at: string;
  updated_at: string;
};
export type TProjectActivityOrder = "-created_at" | "created_at";
export type TProjectOverviewActivity = {
  id: string;
  verb: string;
  field: string;
  old_value: unknown;
  new_value: unknown;
  actor: string | null;
  actor_detail: IUserLite | null;
  created_at: string;
};
export type TProjectOverviewActivityPage = {
  results: TProjectOverviewActivity[];
  next_cursor: string;
  next_page_results: boolean;
};
