/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { setToast } from "@plane/blocks/toast";
import Link from "next/link";
import { useParams } from "next/navigation";
// Plane imports
import type { IWebhook } from "@plane/types";
import { Switch } from "@makeplane/propel/components/switch";
// hooks
import { useWebhook } from "@/hooks/store/use-webhook";
import { translate } from "@plane/i18n";

interface IWebhookListItem {
  webhook: IWebhook;
}

export function WebhooksListItem(props: IWebhookListItem) {
  const { webhook } = props;
  const [saving, setSaving] = useState(false);
  // router
  const { workspaceSlug } = useParams();
  // store hooks
  const { updateWebhook } = useWebhook();

  const handleToggle = async () => {
    if (!workspaceSlug || !webhook.id) return;
    if (saving) return;
    setSaving(true);
    try {
      await updateWebhook(workspaceSlug.toString(), webhook.id, { is_active: !webhook.is_active });
    } catch {
      setToast({ type: "error", title: translate("toast.error"), message: translate("web.webhook_update_failed") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-subtle bg-layer-2 px-4 py-3">
      <Link
        href={`/${workspaceSlug}/settings/webhooks/${webhook?.id}`}
        className="flex items-center justify-between gap-4"
      >
        <div className="min-w-0">
          <h5 className="truncate text-body-sm-medium">{webhook.name || webhook.url}</h5>
          {webhook.name && <p className="truncate text-13 text-tertiary">{webhook.url}</p>}
        </div>
        <div
          className="shrink-0"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onKeyDown={(e) => e.stopPropagation()}
          role="presentation"
        >
          <Switch
            size="md"
            disabled={saving}
            checked={webhook.is_active}
            onCheckedChange={() => {
              void handleToggle();
            }}
            aria-label={translate("web.toggle_webhook")}
          />
        </div>
      </Link>
    </div>
  );
}
