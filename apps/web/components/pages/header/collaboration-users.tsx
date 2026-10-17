import { observer } from "mobx-react";
import { Avatar } from "@makeplane/propel/components/avatar";
import { AvatarGroup } from "@makeplane/propel/components/avatar-group";
import type { TCollaborationUser } from "@plane/editor";
import { useTranslation } from "@plane/i18n";
import { getFileURL } from "@plane/utils";
import type { TPageEditorInstance } from "@/store/pages/page-editor-info";

const MAX_VISIBLE = 3;

export function CollaborationUsers({ users, currentUserId }: { users: TCollaborationUser[]; currentUserId?: string }) {
  const { t } = useTranslation();
  if (!users.length) return null;
  const orderedUsers = [
    ...users.filter((user) => user.id === currentUserId),
    ...users.filter((user) => user.id !== currentUserId),
  ];
  const name = (user: TCollaborationUser) => {
    const displayName = user.name.trim() || t("common.unknown_user");
    return user.id === currentUserId ? t("web.page_collaboration_self", { name: displayName }) : displayName;
  };
  const hiddenUsers = orderedUsers.length > MAX_VISIBLE + 1 ? orderedUsers.slice(MAX_VISIBLE) : [];
  return (
    <fieldset
      // Keyboard focus exposes the expanded stack and the same member tooltips as hover.
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
      aria-label={t("web.page_collaboration_users")}
      className="group/presence outline-none focus-visible:rounded-full focus-visible:ring-2 focus-visible:ring-accent-strong [&_*]:transition-[margin] [&_*]:duration-200 motion-reduce:[&_*]:transition-none [&>div]:group-focus-within/presence:space-x-1 [&>div]:group-hover/presence:space-x-1 [&>div>span[aria-hidden]]:group-focus-within/presence:space-x-1 [&>div>span[aria-hidden]]:group-hover/presence:space-x-1"
    >
      <AvatarGroup
        size="sm"
        max={MAX_VISIBLE}
        overflowLabel={t("web.page_collaboration_more", { count: hiddenUsers.length })}
        overflowTooltip={hiddenUsers.map(name).join("\n")}
      >
        {orderedUsers.map((user) => (
          <Avatar
            key={user.id}
            alt={name(user)}
            tooltip={name(user)}
            src={getFileURL(user.avatar ?? "")}
            fallback={user.name.trim().slice(0, 1).toUpperCase() || undefined}
          />
        ))}
      </AvatarGroup>
    </fieldset>
  );
}

// react-doctor-disable-next-line react-doctor/only-export-components -- MobX observer returns a React component.
export const PageCollaborationUsers = observer(
  ({ editor, currentUserId }: { editor: TPageEditorInstance; currentUserId?: string }) => (
    <CollaborationUsers users={editor.collaborationUsers} currentUserId={currentUserId} />
  )
);
