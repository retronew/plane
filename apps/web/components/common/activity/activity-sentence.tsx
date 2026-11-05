import type { ReactNode } from "react";
import { useTranslation } from "@plane/i18n";
import { cn } from "@plane/utils";
import styles from "./activity-sentence.module.css";

/** Render sentence punctuation separately from user-authored values and links. */
export function ActivitySentenceEnd() {
  const { t } = useTranslation();
  return <>{t("web.ui.sentence_end")}</>;
}

/** Keep translated prose and its dynamic links/chips readable in every activity feed. */
export function ActivitySentence({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn(styles.message, className)}>{children}</span>;
}
