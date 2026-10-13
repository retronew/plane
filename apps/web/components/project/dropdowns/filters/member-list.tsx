/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// plane imports
import { Button } from "@makeplane/propel/components/button";
import { Icon } from "@makeplane/propel/components/icon";
import {
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuGroup,
  MenuLabel,
  MenuTrigger,
} from "@makeplane/propel/components/menu";
import { ChevronDownOutline } from "@makeplane/propel/icons";
import { useTranslation, translate } from "@plane/i18n";
import { EUserProjectRoles, EUserWorkspaceRoles } from "@plane/types";

interface IRoleOption {
  value: string;
  label: string;
}

type Props = {
  appliedFilters: string[] | null;
  handleUpdate: (role: string) => void;
  memberType: "project" | "workspace";
};

const PROJECT_ROLE_OPTIONS: IRoleOption[] = [
  {
    value: String(EUserProjectRoles.ADMIN),
    get label() {
      return translate("web.admin");
    },
  },
  {
    value: String(EUserProjectRoles.MEMBER),
    get label() {
      return translate("web.member");
    },
  },
  {
    value: String(EUserProjectRoles.GUEST),
    get label() {
      return translate("web.guest");
    },
  },
];

const WORKSPACE_ROLE_OPTIONS: IRoleOption[] = [
  {
    value: String(EUserWorkspaceRoles.ADMIN),
    get label() {
      return translate("web.admin");
    },
  },
  {
    value: String(EUserWorkspaceRoles.MEMBER),
    get label() {
      return translate("web.member");
    },
  },
  {
    value: String(EUserWorkspaceRoles.GUEST),
    get label() {
      return translate("web.guest");
    },
  },
  {
    value: "suspended",
    get label() {
      return translate("web.suspended");
    },
  },
];

// Dropdown component for member list filters
export const MemberListFiltersDropdown = observer(function MemberListFiltersDropdown(props: Props) {
  const { appliedFilters, handleUpdate, memberType } = props;
  // plane hooks
  const { t } = useTranslation();
  // derived values
  const roleOptions = memberType === "project" ? PROJECT_ROLE_OPTIONS : WORKSPACE_ROLE_OPTIONS;
  const appliedFiltersCount = appliedFilters?.length ?? 0;
  const appliedFilterSet = new Set(appliedFilters);

  return (
    <Menu>
      <div className="relative w-fit">
        <MenuTrigger
          render={
            <Button
              variant="secondary"
              size="md"
              stretch="auto"
              label={t("common.filters")}
              icon={<Icon icon={<ChevronDownOutline className="h-3 w-3" />} />}
              iconPosition="end"
            />
          }
        />
        {appliedFiltersCount > 0 && <div className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-accent-primary" />}
      </div>
      <MenuContent side="bottom" align="start">
        <MenuGroup>
          <MenuLabel meta={appliedFiltersCount > 0 ? String(appliedFiltersCount) : undefined}>
            {t("web.roles")}
          </MenuLabel>
          {roleOptions.map((role) => (
            <MenuCheckboxItem
              key={`role-${role.value}`}
              label={role.label}
              checked={appliedFilterSet.has(role.value)}
              onCheckedChange={() => handleUpdate(role.value)}
            />
          ))}
        </MenuGroup>
      </MenuContent>
    </Menu>
  );
});
