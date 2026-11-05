import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Button } from "@makeplane/propel/components/button";
import { useTranslation } from "@plane/i18n";
import type { TDailyDigestPreview, TDailyDigestSection } from "@plane/types";

const INITIAL_ITEMS = 3;
function DigestSection({ section }: { section: TDailyDigestSection }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const items = expanded ? section.items : section.items.slice(0, INITIAL_ITEMS);
  return (
    <section className="min-w-0 overflow-hidden rounded-md border border-subtle">
      <div className="flex items-center justify-between gap-3 bg-layer-1 px-3 py-2.5">
        <h4 className="text-13 font-medium text-primary">
          {t(`notification_preferences.digest.modules.${section.key}`)}
        </h4>
        <span className="shrink-0 text-14 font-medium text-primary tabular-nums">
          {t("notification_preferences.digest.item_count", { count: section.count })}
        </span>
      </div>
      {items.length > 0 && (
        <ul className="divide-y divide-subtle px-3">
          {items.map((item) => (
            <li key={item.id} className="py-2.5 text-13">
              <Link
                to={`/${item.workspace_slug}/projects/${item.project_id}/issues/${item.id}`}
                className="group focus-visible:outline-accent-primary flex min-w-0 items-baseline gap-3 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <span className="w-20 shrink-0 text-12 text-secondary">{item.identifier}</span>
                <span className="line-clamp-2 min-w-0 break-words text-primary group-hover:underline">{item.name}</span>
              </Link>
            </li>
          ))}
          {(section.items.length > INITIAL_ITEMS || section.count > section.items.length) && (
            <li className="flex flex-wrap items-center justify-between gap-2 py-2 text-12 text-secondary">
              {section.items.length > INITIAL_ITEMS && (
                <Button
                  stretch="auto"
                  variant="secondary"
                  size="sm"
                  label={t(
                    expanded
                      ? "notification_preferences.digest.collapse_items"
                      : "notification_preferences.digest.expand_items",
                    { count: section.items.length }
                  )}
                  onClick={() => setExpanded((value) => !value)}
                />
              )}
              {section.count > section.items.length && (
                <span>
                  {t("notification_preferences.digest.more_items", { count: section.count - section.items.length })}
                </span>
              )}
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

export function DigestPreview({ digest }: { digest: TDailyDigestPreview }) {
  const { t, currentLocale } = useTranslation();
  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat(currentLocale, { dateStyle: "medium", timeStyle: "short", timeZone: digest.timezone }),
    [currentLocale, digest.timezone]
  );
  return (
    <div className="min-w-0 space-y-4" data-digest-preview>
      <div className="space-y-1 text-12 leading-5 text-secondary">
        <p>
          {t("notification_preferences.digest.period", {
            start: formatter.format(new Date(digest.period_start)),
            end: formatter.format(new Date(digest.period_end)),
            timezone: digest.timezone,
          })}
        </p>
      </div>
      <div className="space-y-3">
        {digest.sections.map((section) => (
          <DigestSection key={section.key} section={section} />
        ))}
      </div>
      {digest.sections.every((section) => section.count === 0) && (
        <p className="rounded-md bg-layer-1 px-3 py-3 text-13 text-secondary">
          {t("notification_preferences.digest.empty")}
        </p>
      )}
    </div>
  );
}
