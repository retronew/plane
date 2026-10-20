import Link from "next/link";
import { MailsOutline } from "@makeplane/propel/icons";
import { useTranslation } from "@plane/i18n";
import { useWorkspaceInvitations } from "@/hooks/use-workspace-invitations";

export function InvitationReminder() {
  const { t } = useTranslation();
  const { data } = useWorkspaceInvitations();
  if (!data?.length) return null;

  return (
    <Link
      href="/invitations"
      className="flex min-w-0 items-center gap-1.5 rounded-md bg-layer-2 px-2 py-1 text-body-xs-medium text-accent-primary hover:bg-layer-2-hover focus-visible:outline-2 focus-visible:outline-accent-strong"
      aria-label={t("workspace_settings.settings.members.invitation_reminder", { count: data.length })}
    >
      <MailsOutline className="size-4 shrink-0" />
      <output className="hidden truncate lg:inline">
        {t("workspace_settings.settings.members.invitation_reminder", { count: data.length })}
      </output>
      <span className="lg:hidden">{data.length}</span>
    </Link>
  );
}
