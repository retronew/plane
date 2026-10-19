/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useTranslation, translate } from "@plane/i18n";
import { Button } from "@makeplane/propel/components/button";

import { Tooltip } from "@makeplane/propel/components/tooltip";
import type { IApiToken } from "@plane/types";
import {
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogHeader,
  DialogHeading,
  DialogInfo,
  DialogMain,
  DialogTitle,
} from "@makeplane/propel/components/dialog";
import { renderFormattedDate, renderFormattedTime } from "@plane/utils";
// hooks
import { usePlatformOS } from "@/hooks/use-platform-os";
// local imports
import { ApiTokenMcpSetup } from "../mcp-setup";
import { CopyFeedback, useCopyFeedback } from "../copy-feedback";

type Props = {
  showMcpSetup?: boolean;
  handleClose: () => void;
  tokenDetails: IApiToken;
};

export function GeneratedTokenDetails(props: Props) {
  const { handleClose, tokenDetails, showMcpSetup = true } = props;
  const { isMobile } = usePlatformOS();
  const { t } = useTranslation();
  const { copied, copy } = useCopyFeedback();

  return (
    <>
      <DialogMain>
        <DialogHeader>
          <DialogHeading>
            <DialogTitle>{t("workspace_settings.key_created")}</DialogTitle>
            <DialogDescription>
              {t("workspace_settings.copy_key")}{" "}
              <span className="font-medium text-danger-primary">
                {t("workspace_settings.key_unavailable_after_close")}
              </span>
              {showMcpSetup && <span className="mt-1 block">{t("workspace_settings.key_csv_downloaded")}</span>}
            </DialogDescription>
          </DialogHeading>
        </DialogHeader>
        <DialogBody>
          <button
            type="button"
            onClick={() => void copy(tokenDetails.token ?? "")}
            disabled={!tokenDetails.token}
            aria-label={t("web.copy_secret_key")}
            className="flex w-full items-center justify-between truncate rounded-lg border border-strong bg-surface-2 px-3 py-2 text-13 font-medium outline-none"
          >
            <span className="truncate pr-2">{tokenDetails.token}</span>
            <Tooltip label={t("web.copy_secret_key")} disabled={isMobile}>
              <span className="shrink-0 text-secondary">
                <CopyFeedback copied={copied} />
              </span>
            </Tooltip>
          </button>
          {showMcpSetup && tokenDetails.token && <ApiTokenMcpSetup token={tokenDetails.token} />}
        </DialogBody>
      </DialogMain>
      <DialogActions>
        <DialogInfo>
          {tokenDetails.expired_at
            ? translate("web.runtime.expires_at", {
                date: renderFormattedDate(tokenDetails.expired_at) ?? "",
                time: renderFormattedTime(tokenDetails.expired_at) ?? "",
              })
            : t("web.never_expires")}
        </DialogInfo>
        <Button variant="secondary" size="sm" stretch="auto" label={t("close")} onClick={handleClose} />
      </DialogActions>
    </>
  );
}
