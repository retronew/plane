/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { set } from "lodash-es";
import { action, makeObservable, observable, runInAction, actionBound } from "mobx";
// types
import type { TLink, TLinkIdMap, TLinkMap } from "@plane/types";
// services
import { WorkspaceService } from "@/services/workspace.service";

export interface IWorkspaceLinkStoreActions {
  addLinks: (projectId: string, links: TLink[]) => void;
  fetchLinks: (workspaceSlug: string) => Promise<TLink[]>;
  createLink: (workspaceSlug: string, data: Partial<TLink>) => Promise<TLink>;
  updateLink: (workspaceSlug: string, linkId: string, data: Partial<TLink>) => Promise<TLink>;
  removeLink: (workspaceSlug: string, linkId: string) => Promise<void>;
  reorderLink: (workspaceSlug: string, linkId: string, destinationIndex: number) => Promise<void>;
  setLinkData: (link: TLink | undefined) => void;
  toggleLinkModal: (isOpen: boolean) => void;
}

export interface IWorkspaceLinkStore extends IWorkspaceLinkStoreActions {
  // observables
  links: TLinkIdMap;
  linkMap: TLinkMap;
  linkData: TLink | undefined;
  isLinkModalOpen: boolean;
  isReorderingLinks: Record<string, boolean>;
  // helper methods
  getLinksByWorkspaceId: (projectId: string) => string[] | undefined;
  getLinkById: (linkId: string) => TLink | undefined;
}

export class WorkspaceLinkStore implements IWorkspaceLinkStore {
  // observables
  links: TLinkIdMap = {};
  linkMap: TLinkMap = {};
  linkData: TLink | undefined = undefined;
  isLinkModalOpen = false;
  isReorderingLinks: Record<string, boolean> = {};
  // services
  workspaceService: WorkspaceService;

  constructor() {
    makeObservable(this, {
      // observables
      links: observable,
      linkMap: observable,
      linkData: observable,
      isLinkModalOpen: observable,
      isReorderingLinks: observable,
      reorderLink: action,
      // actions
      addLinks: actionBound,
      fetchLinks: action,
      createLink: action,
      updateLink: action,
      removeLink: action,
      setLinkData: action,
      toggleLinkModal: action,
    });
    // services
    this.workspaceService = new WorkspaceService();
  }

  // helper methods
  getLinksByWorkspaceId = (projectId: string) => {
    if (!projectId) return undefined;
    return this.links[projectId] ?? undefined;
  };

  getLinkById = (linkId: string) => {
    if (!linkId) return undefined;
    return this.linkMap[linkId] ?? undefined;
  };

  // actions
  setLinkData = (link: TLink | undefined) => {
    runInAction(() => {
      this.linkData = link;
    });
  };

  toggleLinkModal = (isOpen: boolean) => {
    runInAction(() => {
      this.isLinkModalOpen = isOpen;
    });
  };

  addLinks = (workspaceSlug: string, links: TLink[]) => {
    runInAction(() => {
      this.links[workspaceSlug] = links.map((link) => link.id);
      links.forEach((link, index) =>
        set(this.linkMap, link.id, {
          ...link,
          sort_order: Number.isFinite(link.sort_order) ? link.sort_order : index * 10000,
        })
      );
    });
  };

  fetchLinks = async (workspaceSlug: string) => {
    const response = await this.workspaceService.fetchWorkspaceLinks(workspaceSlug);
    this.addLinks(workspaceSlug, response);
    return response;
  };

  createLink = async (workspaceSlug: string, data: Partial<TLink>) => {
    const response = await this.workspaceService.createWorkspaceLink(workspaceSlug, data);

    runInAction(() => {
      this.links[workspaceSlug] = [response.id, ...(this.links[workspaceSlug] ?? [])];
      const nextLink = this.linkMap[this.links[workspaceSlug][1]];
      set(this.linkMap, response.id, {
        ...response,
        sort_order: Number.isFinite(response.sort_order)
          ? response.sort_order
          : (nextLink?.sort_order ?? 10000) - 10000,
      });
    });
    return response;
  };

  updateLink = async (workspaceSlug: string, linkId: string, data: Partial<TLink>) => {
    runInAction(() => {
      Object.keys(data).forEach((key) => {
        set(this.linkMap, [linkId, key], data[key as keyof TLink]);
      });
    });

    const response = await this.workspaceService.updateWorkspaceLink(workspaceSlug, linkId, data);
    return response;
  };

  reorderLink = async (workspaceSlug: string, linkId: string, destinationIndex: number) => {
    const ids = this.links[workspaceSlug];
    const link = this.linkMap[linkId];
    const sourceIndex = ids?.indexOf(linkId) ?? -1;
    if (this.isReorderingLinks[workspaceSlug]) throw new Error("Quick link sorting is already being saved");
    if (
      !ids ||
      !link ||
      sourceIndex < 0 ||
      !Number.isInteger(destinationIndex) ||
      destinationIndex < 0 ||
      destinationIndex >= ids.length ||
      destinationIndex === sourceIndex
    )
      return;

    const previousIds = [...ids];
    const previousSortOrder = link.sort_order;
    const nextIds = ids.filter((id) => id !== linkId);
    const before = this.linkMap[nextIds[destinationIndex - 1]]?.sort_order;
    const after = this.linkMap[nextIds[destinationIndex]]?.sort_order;
    const sortOrder =
      before === undefined ? (after ?? 10000) - 10000 : after === undefined ? before + 10000 : before / 2 + after / 2;
    if (
      !Number.isFinite(sortOrder) ||
      (before !== undefined && sortOrder <= before) ||
      (after !== undefined && sortOrder >= after)
    ) {
      throw new Error("Cannot calculate a finite quick link sort order");
    }
    nextIds.splice(destinationIndex, 0, linkId);
    runInAction(() => {
      this.isReorderingLinks[workspaceSlug] = true;
      this.links[workspaceSlug] = nextIds;
      link.sort_order = sortOrder;
    });
    try {
      await this.workspaceService.updateWorkspaceLink(workspaceSlug, linkId, { sort_order: sortOrder });
    } catch (error) {
      runInAction(() => {
        const currentIds = this.links[workspaceSlug] ?? [];
        if (currentIds.includes(linkId) && this.linkMap[linkId]) {
          const restoredIds = currentIds.filter((id) => id !== linkId);
          const remainingIds = new Set(restoredIds);
          const nextAnchor = previousIds.slice(sourceIndex + 1).find((id) => remainingIds.has(id));
          let previousAnchor: string | undefined;
          for (let index = sourceIndex - 1; index >= 0; index--) {
            if (remainingIds.has(previousIds[index])) {
              previousAnchor = previousIds[index];
              break;
            }
          }
          const restoreIndex = nextAnchor
            ? restoredIds.indexOf(nextAnchor)
            : previousAnchor
              ? restoredIds.indexOf(previousAnchor) + 1
              : restoredIds.length;
          restoredIds.splice(restoreIndex, 0, linkId);
          this.links[workspaceSlug] = restoredIds;
          this.linkMap[linkId].sort_order = previousSortOrder;
        }
      });
      throw error;
    } finally {
      runInAction(() => {
        this.isReorderingLinks[workspaceSlug] = false;
      });
    }
  };

  removeLink = async (workspaceSlug: string, linkId: string) => {
    // const issueLinkCount = this.getLinksByWorkspaceId(projectId)?.length ?? 0;
    await this.workspaceService.deleteWorkspaceLink(workspaceSlug, linkId);

    const linkIndex = this.links[workspaceSlug].findIndex((link) => link === linkId);
    if (linkIndex >= 0)
      runInAction(() => {
        this.links[workspaceSlug].splice(linkIndex, 1);
        delete this.linkMap[linkId];
      });
  };
}
