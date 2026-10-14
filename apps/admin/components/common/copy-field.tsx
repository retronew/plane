/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
// propel's CopyOutline is drawn tall and narrow; lucide's Copy is square
import { Copy } from "lucide-react";
// ui
import { Input, InputGroup } from "@makeplane/propel/components/input";
// components
import { setToast } from "@plane/blocks/toast";
import { useTranslation } from "@plane/i18n";

type Props = {
  label: string;
  url: string;
  description: string | React.ReactNode;
};

export type TCopyField = {
  key: string;
  label: string;
  url: string;
  description: string | React.ReactNode;
};

export function CopyField(props: Props) {
  const { label, url, description } = props;
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-1">
      <h4 className="text-13 text-tertiary">{label}</h4>
      {/* Same InputGroup as the form inputs (read-only), with the copy action where the password toggle sits */}
      <InputGroup size="lg">
        <Input
          size="lg"
          value={url}
          readOnly
          title={url}
          aria-label={label}
          onFocus={(e) => e.currentTarget.select()}
        />
        <button
          type="button"
          aria-label={t("admin.copy.aria_label", { label })}
          className="flex items-center justify-center text-placeholder hover:text-secondary"
          onClick={() => {
            navigator.clipboard.writeText(url);
            setToast({
              type: "info",
              title: t("admin.copy.title"),
              message: t("admin.copy.message", { label }),
            });
          }}
        >
          <Copy className="h-4 w-4" />
        </button>
      </InputGroup>
      <div className="text-11 text-tertiary">{description}</div>
    </div>
  );
}
