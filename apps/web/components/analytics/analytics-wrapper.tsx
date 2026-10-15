/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
// plane package imports
import { useTranslation } from "@plane/i18n";
import { cn } from "@plane/utils";

type Props = {
  i18nTitle: string;
  children: React.ReactNode;
  className?: string;
  hideTitle?: boolean;
};

function AnalyticsWrapper(props: Props) {
  const { i18nTitle, children, className, hideTitle } = props;
  const { t } = useTranslation();
  return (
    <div className={cn("px-6 py-6", className)}>
      {!hideTitle && <h1 className="mb-5 text-20 font-semibold">{t(i18nTitle)}</h1>}
      {children}
    </div>
  );
}

export default AnalyticsWrapper;
