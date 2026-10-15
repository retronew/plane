import { useTranslation } from "@plane/i18n";
export function StatisticsNote({
  kind,
}: {
  kind: "completion" | "intake" | "duplicates" | "trend" | "cycle" | "cohort" | "reconstructed";
}) {
  const { t } = useTranslation();
  return <p className="text-12 leading-relaxed text-tertiary">{t(`workspace_analytics.methodology.${kind}`)}</p>;
}
