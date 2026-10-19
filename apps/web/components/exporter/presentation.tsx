/** Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only */

import { Download } from "lucide-react";
import { translate } from "@plane/i18n";

export function ExportDownload({ provider, url }: { provider: string; url?: string }) {
  if (!url) return <span>—</span>;
  const format = provider === "xlsx" ? "Excel" : provider.toUpperCase();
  return (
    <a
      className="inline-flex items-center gap-1 rounded-sm font-medium text-accent-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
      target="_blank"
      href={url}
      rel="noopener noreferrer"
    >
      <Download className="size-4" aria-hidden />
      {translate("web.download_format", { format })}
    </a>
  );
}
