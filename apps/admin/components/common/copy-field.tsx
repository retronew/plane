/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
// ui
import { Button } from "@makeplane/propel/components/button";
import { CopyOutline } from "@makeplane/propel/icons";
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
      <Button
        variant="secondary"
        size="md"
        stretch="auto"
        icon={<CopyOutline width={18} height={18} color="#B9B9B9" />}
        iconPosition="end"
        label={url}
        onClick={() => {
          navigator.clipboard.writeText(url);
          setToast({
            type: "info",
            title: t("admin.copy.title"),
            message: t("admin.copy.message", { label }),
          });
        }}
      />
      <div className="text-11 text-tertiary">{description}</div>
    </div>
  );
}
