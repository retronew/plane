import { Tooltip } from "@makeplane/propel/components/tooltip";
import { useTranslation } from "@plane/i18n";

type Props = {
  created: number;
  assigned: number;
  pending: number;
  completed: number;
};

export function ProfileProjectProgress({ created, assigned, pending, completed }: Props) {
  const { t } = useTranslation();
  const segments = [
    { key: "web.created", count: created, color: "#203b80" },
    { key: "web.assigned", count: assigned, color: "#3f76ff" },
    { key: "web.due", count: pending, color: "#f59e0b" },
    { key: "web.completed", count: completed, color: "#16a34a" },
  ];
  const total = created + assigned + pending + completed;
  if (total <= 0) return null;
  return (
    <div className="flex items-center gap-0.5">
      {segments
        .filter((segment) => segment.count > 0)
        .map((segment) => {
          const label = `${t(segment.key)} · ${segment.count} ${t("issues")}`;
          return (
            <Tooltip key={segment.key} label={label} side="top">
              <span
                data-profile-progress-segment=""
                className="block py-1"
                style={{ width: `${(segment.count / total) * 100}%` }}
              >
                <span className="sr-only">{label}</span>
                <span aria-hidden="true" className="block h-1 rounded-sm" style={{ backgroundColor: segment.color }} />
              </span>
            </Tooltip>
          );
        })}
    </div>
  );
}
