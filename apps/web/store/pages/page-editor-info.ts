/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { action, makeObservable, observable, runInAction, observableRef } from "mobx";
// plane imports
import type { EditorRefApi, TEditorAsset, TCollaborationUser } from "@plane/editor";

export type TPageEditorInstance = {
  // observables
  assetsList: TEditorAsset[];
  collaborationUsers: TCollaborationUser[];
  editorRef: EditorRefApi | null;
  // actions
  setEditorRef: (editorRef: EditorRefApi | null) => void;
  updateAssetsList: (assets: TEditorAsset[]) => void;
};

export class PageEditorInstance implements TPageEditorInstance {
  // observables
  editorRef: EditorRefApi | null = null;
  assetsList: TEditorAsset[] = [];
  collaborationUsers: TCollaborationUser[] = [];
  private unsubscribeCollaborationUsers?: () => void;

  constructor() {
    makeObservable(this, {
      // observables
      editorRef: observableRef,
      assetsList: observable,
      collaborationUsers: observableRef,
      // actions
      setEditorRef: action,
      updateAssetsList: action,
    });
  }

  setEditorRef: TPageEditorInstance["setEditorRef"] = (editorRef) => {
    if (this.editorRef === editorRef) return;
    this.unsubscribeCollaborationUsers?.();
    this.unsubscribeCollaborationUsers = undefined;
    this.editorRef = editorRef;
    this.collaborationUsers = [];
    if (!editorRef) return;
    const update = (users: TCollaborationUser[]) => {
      if (this.editorRef !== editorRef) return;
      if (JSON.stringify(this.collaborationUsers) === JSON.stringify(users)) return;
      runInAction(() => {
        this.collaborationUsers = users;
      });
    };
    this.unsubscribeCollaborationUsers = editorRef.onCollaborationUsersChange(update);
    update(editorRef.getCollaborationUsers());
  };

  updateAssetsList: TPageEditorInstance["updateAssetsList"] = (assets) => {
    runInAction(() => {
      this.assetsList = assets;
    });
  };
}
