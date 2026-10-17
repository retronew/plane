/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef, useState } from "react";
import { observer } from "mobx-react";
import { ReactionOutline } from "@makeplane/propel/icons";
import { EmojiPicker, Logo } from "@plane/blocks/emoji-icon-picker";
import type { ChangeHandlerPayload } from "@plane/blocks/emoji-icon-picker";
import { setToast } from "@plane/blocks/toast";
import { translate } from "@plane/i18n";
import { cn } from "@plane/utils";
import type { TPageInstance } from "@/store/pages/base-page";

type Props = { className?: string; page: TPageInstance };

export const PageEditorHeaderLogoPicker = observer(function PageEditorHeaderLogoPicker({ className, page }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const saving = useRef(false);
  const { logo_props, isContentEditable } = page;
  const isSelected = !!logo_props?.in_use;

  const updateLogo = async (value?: ChangeHandlerPayload) => {
    if (!page.isContentEditable || saving.current) return;
    saving.current = true;
    setIsSaving(true);
    try {
      if (value) await page.updatePageLogo(value);
      // The page API stores an absent logo as an empty JSON object.
      else await page.update({ logo_props: {} as NonNullable<TPageInstance["logo_props"]> });
    } catch (error) {
      console.error("Failed to update page icon", error);
      setToast({ type: "error", title: translate("web.failed_to_save_page") });
    } finally {
      saving.current = false;
      setIsSaving(false);
    }
  };

  return (
    <div
      className={cn(
        "inline-flex h-7 shrink-0 items-center overflow-hidden rounded-md",
        {
          "h-6 bg-layer-1": isSelected,
        },
        className
      )}
    >
      <EmojiPicker
        isOpen={isOpen}
        handleToggle={setIsOpen}
        buttonClassName={cn(
          "inline-flex h-7 shrink-0 items-center justify-center gap-1 rounded-sm p-1 text-13 font-medium whitespace-nowrap text-tertiary transition-colors hover:bg-layer-1",
          {
            "bg-layer-1": isOpen,
            "h-full rounded-none px-2 py-0 focus-visible:ring-2 focus-visible:ring-accent-strong focus-visible:ring-inset":
              isSelected,
          }
        )}
        label={
          isSelected ? (
            <Logo logo={logo_props} size={16} type="lucide" />
          ) : (
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <ReactionOutline className="size-4 shrink-0" />
              {translate("web.icon")}
            </span>
          )
        }
        onChange={(value) => void updateLogo(value)}
        defaultIconColor={logo_props?.in_use === "icon" ? logo_props.icon?.color : undefined}
        defaultOpen={logo_props?.in_use === "emoji" ? "emoji" : "icon"}
        disabled={!isContentEditable || isSaving}
      />
      {isSelected && isContentEditable && (
        <button
          type="button"
          className="inline-flex h-full shrink-0 items-center justify-center px-2 py-0 text-13 whitespace-nowrap text-tertiary transition-colors hover:bg-layer-1 focus-visible:ring-2 focus-visible:ring-accent-strong focus-visible:outline-none focus-visible:ring-inset disabled:cursor-not-allowed"
          aria-label={translate("common.clear")}
          disabled={isSaving}
          onClick={() => void updateLogo()}
        >
          {translate("common.clear")}
        </button>
      )}
    </div>
  );
});
