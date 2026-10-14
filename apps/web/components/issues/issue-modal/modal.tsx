/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane imports
import type { EIssuesStoreType, TIssue } from "@plane/types";
// local imports
import { CreateUpdateIssueModalBase } from "./base";
import { IssueModalProvider } from "./provider";

export interface IssuesModalProps {
  data?: Partial<TIssue>;
  isOpen: boolean;
  onClose: () => void;
  beforeFormSubmit?: () => Promise<void>;
  onSubmit?: (res: TIssue) => Promise<void>;
  withDraftIssueWrapper?: boolean;
  storeType?: EIssuesStoreType;
  isDraft?: boolean;
  fetchIssueDetails?: boolean;
  moveToIssue?: boolean;
  modalTitle?: string;
  primaryButtonText?: {
    default: string;
    loading: string;
  };
  isProjectSelectionDisabled?: boolean;
  templateId?: string;
  allowedProjectIds?: string[];
  showActionItemsOnUpdate?: boolean;
}

export const CreateUpdateIssueModal = observer(function CreateUpdateIssueModal(props: IssuesModalProps) {
  const lastOpenProps = useRef(props);
  const [opening, setOpening] = useState({ open: props.isOpen, generation: 0 });
  if (opening.open !== props.isOpen) {
    setOpening({ open: props.isOpen, generation: opening.generation + (props.isOpen ? 1 : 0) });
  }
  if (props.isOpen) lastOpenProps.current = props;
  const displayedProps = props.isOpen ? props : lastOpenProps.current;
  const [isMounted, setIsMounted] = useState(props.isOpen);
  if (props.isOpen && !isMounted) setIsMounted(true);
  useEffect(() => {
    if (props.isOpen) return;
    const timer = setTimeout(() => setIsMounted(false), 450);
    return () => clearTimeout(timer);
  }, [props.isOpen]);
  // router params
  const { cycleId, moduleId } = useParams();
  // derived values
  const dataForPreload = {
    ...displayedProps.data,
    cycle_id: displayedProps.data?.cycle_id ? displayedProps.data?.cycle_id : cycleId ? cycleId.toString() : null,
    module_ids: displayedProps.data?.module_ids
      ? displayedProps.data?.module_ids
      : moduleId
        ? [moduleId.toString()]
        : null,
  };

  if (!props.isOpen && !isMounted) return null;
  return (
    <IssueModalProvider
      key={opening.generation}
      templateId={displayedProps.templateId}
      dataForPreload={dataForPreload}
      allowedProjectIds={displayedProps.allowedProjectIds}
    >
      <CreateUpdateIssueModalBase {...displayedProps} isOpen={props.isOpen} />
    </IssueModalProvider>
  );
});
