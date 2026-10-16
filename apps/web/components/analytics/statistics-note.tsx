import type { ReactNode } from "react";
import { useTranslation } from "@plane/i18n";
export function StatisticsNote({
  kind,
}: {
  kind: "completion" | "intake" | "duplicates" | "trend" | "cycle" | "cohort" | "reconstructed";
}) {
  const { t } = useTranslation();
  return <p className="text-12 leading-relaxed text-tertiary">{t(`workspace_analytics.methodology.${kind}`)}</p>;
}

export function StatisticsNotePanel({ children }: { children: ReactNode }) {
  return <aside className="mt-5 space-y-1.5 rounded-lg border border-subtle bg-layer-1 px-4 py-3">{children}</aside>;
}
