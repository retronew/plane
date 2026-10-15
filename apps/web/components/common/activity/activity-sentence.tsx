import type { ReactNode } from "react";
import { cn } from "@plane/utils";
import styles from "./activity-sentence.module.css";

/** Keep translated prose and its dynamic links/chips readable in every activity feed. */
export function ActivitySentence({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn(styles.message, className)}>{children}</span>;
}
