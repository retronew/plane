/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TSticky } from "@plane/types";
import { translate } from "@plane/i18n";
import { TickOutline } from "@makeplane/propel/icons";
import { STICKY_COLORS_LIST } from "./sticky-colors";

type TProps = {
  handleUpdate: (data: Partial<TSticky>) => Promise<void>;
  selectedColor?: string;
  onSelect?: () => void;
};

export function ColorPalette(props: TProps) {
  const { handleUpdate, selectedColor, onSelect } = props;
  return (
    <div className="w-fit">
      <div className="mb-3 text-12 font-medium text-tertiary">{translate("web.background_colors")}</div>
      <div className="grid grid-cols-4 gap-2">
        {STICKY_COLORS_LIST.map((color) => (
          <button
            key={color.key}
            type="button"
            aria-label={color.label}
            aria-pressed={selectedColor === color.key}
            onClick={() => {
              void handleUpdate({
                background_color: color.key,
              });
              onSelect?.();
            }}
            className="grid size-7 place-items-center rounded-md border border-subtle-1 text-secondary transition-shadow outline-none hover:ring-2 hover:ring-accent-strong/40 focus-visible:ring-2 focus-visible:ring-accent-strong"
            style={{
              backgroundColor: color.backgroundColor,
            }}
          >
            {selectedColor === color.key && <TickOutline className="size-3.5" />}
          </button>
        ))}
      </div>
    </div>
  );
}
