/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { BoardOutline, ListOutline, TimelineOutline } from "@makeplane/propel/icons";
import type { IBaseLayoutConfig } from "@plane/types";
import { translate } from "@plane/i18n";

export const BASE_LAYOUTS: IBaseLayoutConfig[] = [
  {
    key: "list",
    icon: ListOutline,
    get label() {
      return translate("web.list_layout_c");
    },
  },
  {
    key: "kanban",
    icon: BoardOutline,
    get label() {
      return translate("web.board_layout");
    },
  },
  {
    key: "gantt",
    icon: TimelineOutline,
    get label() {
      return translate("web.gantt_layout");
    },
  },
];
