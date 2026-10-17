import { Link } from "react-router";
import { Badge } from "@makeplane/propel/components/badge";
import { TypesLogo } from "./types-logo";
import { useTranslation } from "@plane/i18n";
import type { TProjectIssueType } from "@plane/types";
const key = "web.workflow_ui.types_settings";
const logo = (type: TProjectIssueType) => <TypesLogo type={type} />;
import { groupIssueTypeLevels } from "./types-settings-utils";
export function TypesHierarchy({ types, base }: { types: TProjectIssueType[]; base: string }) {
  const { t } = useTranslation();
  const badge = (type: TProjectIssueType) =>
    type.is_default ? <Badge size="xs" variant="neutral" label={t("common.default")} /> : null;
  return (
    <div className="space-y-4 py-6">
      <p className="text-body-xs-regular text-secondary">{t(`${key}.hierarchy_description`)}</p>
      {groupIssueTypeLevels(types).map(([level, items]) => (
        <section key={level} className="rounded-md border border-subtle p-4">
          <h4 className="mb-3 text-body-xs-medium text-secondary">{t(`${key}.level`, { level })}</h4>
          <div className="flex flex-wrap gap-4">
            {items.map((type) => (
              <Link
                key={type.id}
                to={`${base}types/${type.id}/properties/`}
                className="flex items-center gap-2 text-body-xs-regular text-primary"
              >
                {logo(type)}
                {type.name}
                {badge(type)}
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
