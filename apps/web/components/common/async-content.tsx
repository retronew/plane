import type { CSSProperties, ReactNode } from "react";
import { cn } from "@plane/utils";
import { useDelayedLoading } from "@/hooks/use-delayed-loading";
import styles from "./async-content.module.css";

type Props = {
  loading: boolean;
  children: ReactNode;
  skeleton: ReactNode;
  className?: string;
  minHeight?: CSSProperties["minHeight"];
};
/** Reserve geometry immediately, show a skeleton only for slow requests, enter real content once ready. */
export function AsyncContent({ loading, children, skeleton, className, minHeight }: Props) {
  const showSkeleton = useDelayedLoading(loading);
  return (
    <div
      aria-busy={loading}
      data-async-content={loading ? (showSkeleton ? "skeleton" : "pending") : "ready"}
      className={cn("min-w-0", className)}
      style={loading ? { minHeight } : undefined}
    >
      {loading ? (
        showSkeleton ? (
          <div data-loading-skeleton="">{skeleton}</div>
        ) : null
      ) : (
        <div className={styles.ready}>{children}</div>
      )}
    </div>
  );
}
