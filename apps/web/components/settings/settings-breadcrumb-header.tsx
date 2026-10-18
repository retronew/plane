import type { ComponentType } from "react";
// plane imports
import { Breadcrumbs } from "@plane/blocks/breadcrumb";
// components
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";
import { SettingsPageHeader } from "@/components/settings/page-header";

type Props = {
  label: string;
  icon: ComponentType<{ className?: string }>;
};

/**
 * Settings page header holding a single breadcrumb with the settings icon; shared by the
 * workspace and project settings routes.
 */
export function SettingsBreadcrumbHeader({ label, icon: Icon }: Props) {
  return (
    <SettingsPageHeader
      leftItem={
        <div className="flex items-center gap-2">
          <Breadcrumbs>
            <Breadcrumbs.Item
              component={<BreadcrumbLink label={label} icon={<Icon className="size-4 text-tertiary" />} />}
            />
          </Breadcrumbs>
        </div>
      }
    />
  );
}
