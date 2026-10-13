/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// components
import { PageWrapper } from "@/components/common/page-wrapper";
// hooks
import { useInstance } from "@/hooks/store";
// local imports
import { GeneralConfigurationForm } from "./form";
// types
import type { Route } from "./+types/page";
import { translate, useTranslation } from "@plane/i18n";

function GeneralPage() {
  const { instance, instanceAdmins } = useInstance();
  const { t } = useTranslation();

  return (
    <PageWrapper
      header={{
        title: t("admin.general.title"),
        description: t("admin.general.description"),
      }}
    >
      {instance && instanceAdmins && <GeneralConfigurationForm instance={instance} instanceAdmins={instanceAdmins} />}
    </PageWrapper>
  );
}

export const meta: Route.MetaFunction = () => [{ title: translate("admin.meta.general") }];

export default observer(GeneralPage);
