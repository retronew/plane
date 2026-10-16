import { Tooltip } from "@makeplane/propel/components/tooltip";
import { Progress } from "@base-ui/react/progress";
import { useTranslation } from "@plane/i18n";

/** Keep the cycle icon's outline and inner disc; sweep the disc with progress. */
export function CycleProgressIcon({ value }: { value: number }) {
  const { t } = useTranslation();
  const progress = Math.max(0, Math.min(100, value));
  const circumference = 2 * Math.PI * (13 / 6);

  return (
    <Tooltip label={`${progress}%`}>
      <button
        type="button"
        aria-label={`${t("web.cycle_progress")} ${progress}%`}
        className="inline-flex size-4 shrink-0 rounded-full text-primary outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent-strong"
      >
        <Progress.Root value={progress} aria-label={t("web.cycle_progress")}>
          <svg viewBox="0 0 16 16" fill="none" className="size-4" aria-hidden="true">
            <circle cx="8" cy="8" r={20 / 3} stroke="currentColor" strokeWidth="1.25" />
            <circle
              cx="8"
              cy="8"
              r={13 / 6}
              stroke="currentColor"
              strokeWidth={13 / 3}
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress / 100)}
              transform="rotate(-90 8 8)"
            />
          </svg>
        </Progress.Root>
      </button>
    </Tooltip>
  );
}
