/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { translate } from "@plane/i18n";

import { useState } from "react";
import { observer } from "mobx-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CloseOutline } from "@makeplane/propel/icons";
import { Avatar } from "@makeplane/propel/components/avatar";
// ui
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { convertBytesToSize, getFileExtension, getFileName, getFileURL } from "@plane/utils";
// icons
//
import { getFileIcon } from "@/components/icons";
// components
import { IssueAttachmentDeleteModal } from "@/components/issues/attachment/delete-attachment-modal";
// helpers
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useMember } from "@/hooks/store/use-member";
import { usePlatformOS } from "@/hooks/use-platform-os";
// types
import type { TAttachmentHelpers } from "../issue-detail-widgets/attachments/helper";

type TAttachmentOperationsRemoveModal = Exclude<TAttachmentHelpers, "create">;

type TIssueAttachmentsDetail = {
  attachmentId: string;
  attachmentHelpers: TAttachmentOperationsRemoveModal;
  disabled?: boolean;
};

export const IssueAttachmentsDetail = observer(function IssueAttachmentsDetail(props: TIssueAttachmentsDetail) {
  // props
  const { attachmentId, attachmentHelpers, disabled } = props;
  // store hooks
  const { getUserDetails } = useMember();
  const { workspaceSlug } = useParams();
  const {
    attachment: { getAttachmentById },
  } = useIssueDetail();
  // state
  const [isDeleteIssueAttachmentModalOpen, setIsDeleteIssueAttachmentModalOpen] = useState(false);
  // derived values
  const attachment = attachmentId ? getAttachmentById(attachmentId) : undefined;
  const fileName = getFileName(attachment?.attributes.name ?? "");
  const fileExtension = getFileExtension(attachment?.attributes.name ?? "");
  const fileIcon = getFileIcon(fileExtension, 28);
  const fileURL = getFileURL(attachment?.asset_url ?? "");
  const uploader = attachment?.created_by ? getUserDetails(attachment.created_by) : undefined;
  const uploaderName = uploader?.display_name || uploader?.first_name || uploader?.email;
  // hooks
  const { isMobile } = usePlatformOS();

  if (!attachment) return <></>;

  return (
    <>
      {isDeleteIssueAttachmentModalOpen && (
        <IssueAttachmentDeleteModal
          isOpen={isDeleteIssueAttachmentModalOpen}
          onClose={() => setIsDeleteIssueAttachmentModalOpen(false)}
          attachmentOperations={attachmentHelpers.operations}
          attachmentId={attachmentId}
        />
      )}
      <div className="flex h-[60px] items-center gap-3 rounded-lg border border-subtle-1 px-4 py-2">
        <Link
          href={fileURL ?? ""}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <div className="grid size-7 shrink-0 place-items-center">{fileIcon}</div>
          <div className="flex min-w-0 flex-col">
            <div className="flex min-w-0 items-center gap-2">
              <Tooltip label={fileName} layout="stacked" disabled={isMobile}>
                <span className="truncate text-body-xs-medium text-primary">{fileName}</span>
              </Tooltip>
            </div>

            <div className="flex items-center gap-2 text-caption-sm-regular text-tertiary">
              <span>{fileExtension.toUpperCase()}</span>
              <span>{convertBytesToSize(attachment.attributes.size)}</span>
            </div>
          </div>
        </Link>

        {uploader && uploaderName && (
          <Tooltip label={uploaderName} disabled={isMobile}>
            {workspaceSlug ? (
              <Link
                href={`/${workspaceSlug}/profile/${attachment.created_by}/`}
                aria-label={uploaderName}
                className="inline-flex shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-accent-strong"
              >
                <Avatar size="xs" src={getFileURL(uploader.avatar_url)} alt={uploaderName} tooltip={false} />
              </Link>
            ) : (
              <span className="inline-flex shrink-0">
                <Avatar size="xs" src={getFileURL(uploader.avatar_url)} alt={uploaderName} tooltip={false} />
              </span>
            )}
          </Tooltip>
        )}

        {!disabled && (
          <button
            type="button"
            aria-label={translate("attachment.delete")}
            className="grid size-6 shrink-0 place-items-center rounded-sm text-secondary hover:bg-layer-transparent-hover focus-visible:ring-2 focus-visible:ring-accent-strong"
            onClick={() => setIsDeleteIssueAttachmentModalOpen(true)}
          >
            <CloseOutline className="size-4" />
          </button>
        )}
      </div>
    </>
  );
});
