/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ComponentType } from "react";
import { observer } from "mobx-react";
import {
  ArrowNarrowRightOutline,
  FullScreenPeekOutline,
  LinkOutline,
  ModalPeekOutline,
  SidePeekOutline,
} from "@makeplane/propel/icons";
// plane imports
import { Select } from "@plane/blocks/select";
import { setToast } from "@plane/blocks/toast";
import { useTranslation, translate } from "@plane/i18n";
import { cn } from "@plane/utils";
// helpers
import { copyTextToClipboard } from "@/helpers/string.helper";
// hooks
import { useIssueDetails } from "@/hooks/store/use-issue-details";
import useClipboardWritePermission from "@/hooks/use-clipboard-write-permission";
// types
import type { IIssue, IPeekMode } from "@/types/issue";

type Props = {
  handleClose: () => void;
  issueDetails: IIssue | undefined;
};

type TPeekModeOption = {
  key: IPeekMode;
  icon: ComponentType<{ className?: string }>;
  label: string;
};

function renderPeekModeIcon(mode: TPeekModeOption) {
  return <mode.icon className="size-4 shrink-0" />;
}

function renderSelectedPeekModeIcon(modes: TPeekModeOption[]) {
  const Icon = modes[0]?.icon ?? SidePeekOutline;
  return <Icon className="size-4" />;
}

const PEEK_MODES: TPeekModeOption[] = [
  {
    key: "side",
    icon: SidePeekOutline,
    get label() {
      return translate("web.side_peek");
    },
  },
  {
    key: "modal",
    icon: ModalPeekOutline,
    get label() {
      return translate("web.modal");
    },
  },
  {
    key: "full",
    icon: FullScreenPeekOutline,
    get label() {
      return translate("web.full_screen");
    },
  },
];

export const PeekOverviewHeader = observer(function PeekOverviewHeader(props: Props) {
  const { handleClose } = props;
  // plane hooks
  const { t } = useTranslation();

  const { peekMode, setPeekMode } = useIssueDetails();
  const isClipboardWriteAllowed = useClipboardWritePermission();

  const handleCopyLink = () => {
    const urlToCopy = window.location.href;

    copyTextToClipboard(urlToCopy).then(() => {
      setToast({
        type: "success",
        title: t("web.link_copied_2bb0"),
        message: t("web.work_item_link_copied_to_clipboard_space"),
      });
      return undefined;
    });
  };

  const selectedPeekMode = PEEK_MODES.find((m) => m.key === peekMode) ?? null;

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {peekMode === "side" && (
            <button
              type="button"
              onClick={handleClose}
              className="text-tertiary hover:text-secondary"
              aria-label={t("close")}
            >
              <ArrowNarrowRightOutline className="size-4" />
            </button>
          )}
          <Select<TPeekModeOption>
            getValues={() => PEEK_MODES}
            value={selectedPeekMode}
            onChange={(val) => setPeekMode(val as IPeekMode)}
            showSearch={false}
            pinSelected={false}
            getOptionValue={(mode) => mode.key}
            getOptionLabel={(mode) => mode.label}
            getOptionIcon={renderPeekModeIcon}
          >
            <Select.Trigger<TPeekModeOption>
              variant="icon-sm"
              className={cn("text-tertiary hover:text-secondary", { "rotate-45": peekMode === "full" })}
              prependIcon={renderSelectedPeekModeIcon}
            />
          </Select>
        </div>
        {isClipboardWriteAllowed && (peekMode === "side" || peekMode === "modal") && (
          <button
            type="button"
            onClick={handleCopyLink}
            className="shrink-0 text-tertiary hover:text-secondary focus:outline-none"
            aria-label={t("copy_link")}
          >
            <LinkOutline className="h-4 w-4 -rotate-45" />
          </button>
        )}
      </div>
    </>
  );
});
