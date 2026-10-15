/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef, useState } from "react";
import { Popover as BasePopover } from "@base-ui/react/popover";
import { Button } from "@makeplane/propel/components/button";
import { MenuPanel } from "@plane/blocks/select";
import { useTranslation } from "@plane/i18n";
import type { TFilterValue } from "@plane/types";
import { COMMON_FILTER_ITEM_BORDER_CLASSNAME } from "../shared";

export function TextFilterValueInput({
  value,
  titleOnly,
  disabled,
  onChange,
}: {
  value: TFilterValue | TFilterValue[];
  titleOnly: boolean;
  disabled?: boolean;
  onChange: (value: string | null) => void;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const current = typeof value === "string" ? value : "";
  const [open, setOpen] = useState(!current && !disabled);
  const [draft, setDraft] = useState(current);
  const apply = () => {
    onChange(draft.trim() || null);
    setOpen(false);
  };
  return (
    <BasePopover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setDraft(current);
      }}
    >
      <BasePopover.Trigger
        disabled={disabled}
        title={current || undefined}
        className={`h-full max-w-60 truncate px-2 text-body-xs-regular text-secondary outline-none hover:bg-layer-transparent-hover focus-visible:ring-2 focus-visible:ring-accent-strong ${COMMON_FILTER_ITEM_BORDER_CLASSNAME}`}
      >
        {current || "--"}
      </BasePopover.Trigger>
      <BasePopover.Portal>
        <BasePopover.Positioner side="bottom" align="start" sideOffset={4} className="z-60">
          <BasePopover.Popup
            initialFocus={inputRef}
            aria-label={t(titleOnly ? "common.filter_fields.title" : "common.filter_fields.text")}
            render={<MenuPanel className="w-64" />}
          >
            <form
              onSubmit={(event) => {
                event.preventDefault();
                apply();
              }}
              className="space-y-3 p-2"
            >
              <input
                ref={inputRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                aria-label={t(
                  titleOnly ? "common.filter_fields.title_placeholder" : "common.filter_fields.text_placeholder"
                )}
                placeholder={t(
                  titleOnly ? "common.filter_fields.title_placeholder" : "common.filter_fields.text_placeholder"
                )}
                className="h-8 w-full rounded-md border border-subtle-1 bg-layer-1 px-2 text-body-xs-regular text-primary outline-none focus:border-accent-strong"
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" stretch="auto" onClick={() => setOpen(false)} label={t("cancel")} />
                <Button type="submit" variant="primary" size="sm" stretch="auto" label={t("common.apply")} />
              </div>
            </form>
          </BasePopover.Popup>
        </BasePopover.Positioner>
      </BasePopover.Portal>
    </BasePopover.Root>
  );
}
