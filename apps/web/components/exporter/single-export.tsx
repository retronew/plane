/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// ui
import { ExportDownload } from "./presentation";
import { exportStatusLabel } from "./export-status";
import type { IExportData } from "@plane/types";
// helpers
import { getDate, renderFormattedDate } from "@plane/utils";
import { translate } from "@plane/i18n";
// types

type Props = {
  service: IExportData;
  refreshing: boolean;
};

const checkExpiry = (inputDateString: string) => {
  const currentDate = new Date();
  const expiryDate = getDate(inputDateString);
  if (!expiryDate) return false;
  expiryDate.setDate(expiryDate.getDate() + 7);
  return expiryDate > currentDate;
};

// Lookups keep the row free of nested ternaries; unknown values fall back to empty.
const PROVIDER_LABELS: Record<string, string> = { csv: "CSV", xlsx: "Excel", json: "JSON" };

const STATUS_STYLES: Record<string, string> = {
  completed: "bg-success-subtle text-success-primary",
  processing: "bg-yellow-500/20 text-yellow-500",
  failed: "bg-danger-subtle text-danger-primary",
  expired: "bg-orange-500/20 text-orange-500",
};

export function SingleExport({ service, refreshing }: Props) {
  const provider = service.provider;

  return (
    <div className="flex items-center justify-between gap-2 px-4 py-3">
      <div>
        <h4 className="flex items-center gap-2 text-13">
          <span>
            {translate("web.export_to")} <span className="font-medium">{PROVIDER_LABELS[provider] ?? ""}</span>{" "}
          </span>
          <span className={`rounded-sm px-2 py-0.5 text-11 capitalize ${STATUS_STYLES[service.status] ?? ""}`}>
            {refreshing ? translate("web.refreshing") : exportStatusLabel(service.status)}
          </span>
        </h4>
        <div className="mt-2 flex items-center gap-2 text-11 text-secondary">
          <span>{renderFormattedDate(service.created_at)}</span>|
          <span>
            {translate("web.exported_by_2")} {service?.initiated_by_detail?.display_name}
          </span>
        </div>
      </div>
      {checkExpiry(service.created_at) ? (
        <>
          {service.status == "completed" && (
            <div>
              <ExportDownload provider={service.provider} url={service.url} />
            </div>
          )}
        </>
      ) : (
        <div className="text-11 text-danger-primary">{translate("web.expired")}</div>
      )}
    </div>
  );
}
