import { Fragment } from "react";
import { Link } from "react-router";
import { ArrowDownOutline } from "@makeplane/propel/icons";
import { TypesLogo } from "./types-logo";
import { useTranslation } from "@plane/i18n";
import type { TProjectIssueType } from "@plane/types";
const key = "web.workflow_ui.types_settings";
const logo = (type: TProjectIssueType) => <TypesLogo type={type} />;
import { groupIssueTypeLevels } from "./types-settings-utils";
export function TypesHierarchy({ types, base }: { types: TProjectIssueType[]; base: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h4 className="text-h6-medium text-primary">{t(`${key}.hierarchy`)}</h4>
        <p className="mt-1 text-body-xs-regular text-secondary">{t(`${key}.hierarchy_description`)}</p>
      </div>
      <div className="rounded-lg bg-surface-2 p-4">
        {groupIssueTypeLevels(types).map(([level, items], index) => (
          <Fragment key={level}>
            {index > 0 && (
              <div aria-hidden="true" className="h-8 py-1 pl-4 text-tertiary">
                <ArrowDownOutline className="size-6" />
              </div>
            )}
            <section className="flex items-center gap-2 rounded-lg border border-subtle bg-layer-2 p-3">
              <h5 className="grid size-8 shrink-0 place-items-center rounded-md bg-layer-3 text-caption-md-medium text-secondary">
                {level}
              </h5>
              <div className="flex flex-wrap items-center gap-2">
                {items.map((type) => (
                  <Link
                    key={type.id}
                    to={`${base}types/${type.id}/properties/`}
                    className="inline-flex h-6 items-center gap-1 rounded-md bg-layer-3 px-1.5 text-body-xs-medium text-secondary [&_svg]:size-3 [&_svg]:shrink-0"
                  >
                    {logo(type)}
                    {type.name}
                  </Link>
                ))}
              </div>
            </section>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
