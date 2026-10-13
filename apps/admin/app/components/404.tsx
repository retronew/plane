/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { Link } from "react-router";
// ui
import { Button } from "@makeplane/propel/components/button";
// images
import Image404 from "@/app/assets/images/404.svg?url";
import { useTranslation } from "@plane/i18n";

function PageNotFound() {
  const { t } = useTranslation();
  return (
    <div className={`h-screen w-full overflow-hidden bg-surface-1`}>
      <div className="grid h-full place-items-center p-4">
        <div className="space-y-8 text-center">
          <div className="relative mx-auto h-60 w-60 lg:h-80 lg:w-80">
            <img src={Image404} alt={t("admin.not_found.image_alt")} className="h-full w-full object-contain" />
          </div>
          <div className="space-y-2">
            <h3 className="text-16 font-semibold">{t("admin.not_found.title")}</h3>
            <p className="text-13 text-secondary">{t("admin.not_found.description")}</p>
          </div>
          <div className="flex justify-center py-4">
            <Button
              variant="secondary"
              size="md"
              stretch="auto"
              nativeButton={false}
              render={<Link to="/general/" />}
              label={t("admin.not_found.go_to_general")}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default PageNotFound;
