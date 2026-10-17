/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import type {
  TProjectActivityOrder,
  TProjectOverviewLink,
  TProjectOverviewReaction,
  TProjectOverviewUpdate,
  TProjectOverviewUpdateComment,
  TProjectOverviewActivityPage,
  TProjectOverviewAttachment,
  TProjectUpdateHealth,
} from "@plane/types";
import { APIService } from "@/services/api.service";

export const projectOverviewKey = (slug: string, projectId: string, resource: string) =>
  ["project-overview", slug, projectId, resource] as const;

export class ProjectOverviewService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }
  private path(slug: string, projectId: string, resource: string) {
    return `/api/workspaces/${slug}/projects/${projectId}/${resource}/`;
  }
  async getLinks(slug: string, projectId: string): Promise<TProjectOverviewLink[]> {
    return (await this.get(this.path(slug, projectId, "links"))).data;
  }
  async createLink(
    slug: string,
    projectId: string,
    data: { title: string; url: string }
  ): Promise<TProjectOverviewLink> {
    return (await this.post(this.path(slug, projectId, "links"), data)).data;
  }
  async updateLink(
    slug: string,
    projectId: string,
    id: string,
    data: { title: string; url: string }
  ): Promise<TProjectOverviewLink> {
    return (await this.patch(this.path(slug, projectId, `links/${id}`), data)).data;
  }
  async deleteLink(slug: string, projectId: string, id: string): Promise<void> {
    await this.delete(this.path(slug, projectId, `links/${id}`));
  }
  async getReactions(slug: string, projectId: string): Promise<TProjectOverviewReaction[]> {
    return (await this.get(this.path(slug, projectId, "reactions"))).data;
  }
  async addReaction(slug: string, projectId: string, reaction: string): Promise<void> {
    await this.post(this.path(slug, projectId, "reactions"), { reaction });
  }
  async deleteReaction(slug: string, projectId: string, reaction: string): Promise<void> {
    await this.delete(this.path(slug, projectId, "reactions"), { reaction });
  }
  async getUpdates(slug: string, projectId: string): Promise<TProjectOverviewUpdate[]> {
    return (await this.get(this.path(slug, projectId, "updates"))).data;
  }
  async createUpdate(
    slug: string,
    projectId: string,
    data: { body: string; health: TProjectUpdateHealth }
  ): Promise<TProjectOverviewUpdate> {
    return (await this.post(this.path(slug, projectId, "updates"), data)).data;
  }
  async updateUpdate(
    slug: string,
    projectId: string,
    id: string,
    data: { body: string; health: TProjectUpdateHealth }
  ): Promise<TProjectOverviewUpdate> {
    return (await this.patch(this.path(slug, projectId, `updates/${id}`), data)).data;
  }
  async deleteUpdate(slug: string, projectId: string, id: string): Promise<void> {
    await this.delete(this.path(slug, projectId, `updates/${id}`));
  }
  async getUpdateComments(slug: string, projectId: string, updateId: string): Promise<TProjectOverviewUpdateComment[]> {
    return (await this.get(this.path(slug, projectId, `updates/${updateId}/comments`))).data;
  }
  async createUpdateComment(
    slug: string,
    projectId: string,
    updateId: string,
    body: string
  ): Promise<TProjectOverviewUpdateComment> {
    return (await this.post(this.path(slug, projectId, `updates/${updateId}/comments`), { body })).data;
  }
  async updateUpdateComment(
    slug: string,
    projectId: string,
    updateId: string,
    commentId: string,
    body: string
  ): Promise<TProjectOverviewUpdateComment> {
    return (await this.patch(this.path(slug, projectId, `updates/${updateId}/comments/${commentId}`), { body })).data;
  }
  async deleteUpdateComment(slug: string, projectId: string, updateId: string, commentId: string): Promise<void> {
    await this.delete(this.path(slug, projectId, `updates/${updateId}/comments/${commentId}`));
  }
  async addUpdateReaction(slug: string, projectId: string, updateId: string, reaction: string): Promise<void> {
    await this.post(this.path(slug, projectId, `updates/${updateId}/reactions`), { reaction });
  }
  async deleteUpdateReaction(slug: string, projectId: string, updateId: string, reaction: string): Promise<void> {
    await this.delete(this.path(slug, projectId, `updates/${updateId}/reactions`), { reaction });
  }
  async getActivities(
    slug: string,
    projectId: string,
    cursor?: string,
    orderBy: TProjectActivityOrder = "-created_at"
  ): Promise<TProjectOverviewActivityPage> {
    return (
      await this.get(this.path(slug, projectId, "activities"), {
        params: { per_page: 20, order_by: orderBy, ...(cursor ? { cursor } : {}) },
      })
    ).data;
  }
  async getAttachments(slug: string, projectId: string): Promise<TProjectOverviewAttachment[]> {
    return (await this.get(`/api/assets/v2/workspaces/${slug}/projects/${projectId}/`)).data;
  }
  async deleteAttachment(slug: string, projectId: string, id: string): Promise<void> {
    await this.delete(`/api/assets/v2/workspaces/${slug}/projects/${projectId}/${id}/`);
  }
}

export const projectOverviewService = new ProjectOverviewService();
