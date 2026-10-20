/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";

type TGlobalModalsProps = {
  workspaceSlug: string;
};

/** Workspace-level modal extension point. Personal settings live in AppProvider. */
export const GlobalModals = observer(function GlobalModals(_props: TGlobalModalsProps) {
  return null;
});
