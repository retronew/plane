/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import type { ReactNode } from "react";
import { Controller, useFormContext } from "react-hook-form";
// plane imports
import { ETabIndices } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { EmojiPicker, ProjectLogo, getIconBackgroundStyle } from "@plane/blocks/emoji-icon-picker";
import { CloseOutline } from "@makeplane/propel/icons";
// plane types
import type { IProject } from "@plane/types";
// plane ui
import { getTabIndex } from "@plane/utils";

type Props = {
  handleClose: () => void;
  isMobile?: boolean;
  handleFormOnChange?: () => void;
  isClosable?: boolean;
  handleTemplateSelect?: () => void;
  showActionButtons?: boolean;
  templatePicker?: ReactNode;
};

function ProjectCreateHeader(props: Props) {
  const { handleClose, isMobile = false, isClosable = true, templatePicker } = props;
  const { t } = useTranslation();

  const { getIndex } = getTabIndex(ETabIndices.PROJECT_CREATE, isMobile);

  return (
    <div className="flex w-full shrink-0 items-center justify-between gap-3 px-3 pt-3 pb-2">
      <h3 className="text-13 font-medium text-primary">{t("create_project")}</h3>
      <div className="flex items-center gap-2">
        {templatePicker}
        {isClosable && (
          <button
            type="button"
            aria-label={t("close")}
            onClick={handleClose}
            tabIndex={getIndex("close")}
            className="rounded-md p-1 text-secondary outline-none hover:bg-layer-1 hover:text-primary focus-visible:ring-2 focus-visible:ring-accent-strong"
          >
            <CloseOutline className="size-5" />
          </button>
        )}
      </div>
    </div>
  );
}

export function ProjectCreateLogo({ handleFormOnChange }: { handleFormOnChange?: () => void }) {
  const { control, setValue } = useFormContext<IProject>();
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="shrink-0">
      <Controller
        name="logo_props"
        control={control}
        render={({ field: { value, onChange } }) => (
          <EmojiPicker
            iconType="material"
            isOpen={isOpen}
            handleToggle={(val: boolean) => setIsOpen(val)}
            className="flex items-center justify-center"
            buttonClassName="flex items-center justify-center"
            searchPlaceholder={t("common.search.label")}
            label={
              <span
                style={getIconBackgroundStyle(value)}
                className="grid size-10 place-items-center rounded-lg bg-layer-1"
              >
                <ProjectLogo background={false} logo={value} size={20} />
              </span>
            }
            onChange={(val: any) => {
              let logoValue = {};

              if (val?.type === "emoji")
                logoValue = {
                  value: val.value,
                };
              else if (val?.type === "icon") logoValue = val.value;

              const newLogoProps = {
                in_use: val?.type,
                [val?.type]: logoValue,
              };
              setValue("logo_props", newLogoProps, {
                shouldDirty: true,
              });
              onChange(newLogoProps);
              handleFormOnChange?.();
              setIsOpen(false);
            }}
            defaultIconBackground={value?.icon?.background_color}
            onIconBackgroundChange={(background) => {
              if (value?.in_use === "icon")
                onChange({ ...value, icon: { ...value.icon, background_color: background } });
            }}
            defaultIconColor={value?.in_use && value.in_use === "icon" ? value.icon?.color : undefined}
            defaultOpen={value?.in_use && value.in_use === "emoji" ? "emoji" : "icon"}
          />
        )}
      />
    </div>
  );
}

export default ProjectCreateHeader;
