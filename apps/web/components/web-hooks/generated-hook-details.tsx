/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// components
// ui
import { useTranslation } from "@plane/i18n";
import { Button } from "@makeplane/propel/components/button";
import type { IWebhook } from "@plane/types";
import { cn } from "@plane/utils";
// types
import { WebhookSecretKey } from "./form";

type Props = {
  inline?: boolean;
  handleClose: () => void;
  webhookDetails: IWebhook;
};

export function GeneratedHookDetails(props: Props) {
  const { handleClose, webhookDetails, inline = false } = props;
  const { t } = useTranslation();

  return (
    <>
      <div className={cn("space-y-5", !inline && "p-5")}>
        <div className="space-y-3">
          <h3 className="text-18 font-medium text-secondary">{t("workspace_settings.key_created")}</h3>
          <p className="text-13 text-placeholder">{t("workspace_settings.copy_key")}</p>
        </div>
        <WebhookSecretKey data={webhookDetails} />
      </div>
      <div
        className={cn(
          "flex items-center justify-end gap-2 border-t-[0.5px] border-subtle py-4",
          inline ? "mt-5" : "px-5"
        )}
      >
        <Button variant="secondary" size="md" stretch="auto" label={t("web.close")} onClick={handleClose} />
      </div>
    </>
  );
}
