import { observer } from "mobx-react";
import { Avatar } from "@makeplane/propel/components/avatar";
import { getFileURL } from "@plane/utils";
import { useMember } from "@/hooks/store/use-member";

export const ApprovalMemberLink = observer(function ApprovalMemberLink({
  workspaceSlug,
  memberId,
  name,
  label,
}: {
  workspaceSlug: string;
  memberId: string;
  name: string;
  label?: string;
}) {
  const { getUserDetails } = useMember();
  const member = getUserDetails(memberId);
  const displayName = member?.display_name || name;
  return (
    <a
      href={`/${workspaceSlug}/profile/${memberId}/`}
      aria-label={displayName}
      className="inline-flex max-w-full items-center gap-1.5 rounded-sm text-caption-md-regular text-secondary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
    >
      <Avatar
        size="xs"
        alt={displayName}
        fallback={displayName[0]?.toUpperCase()}
        src={getFileURL(member?.avatar_url ?? "")}
      />
      <span className="min-w-0 break-words underline-offset-2 hover:underline">{label ?? displayName}</span>
    </a>
  );
});
