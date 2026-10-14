/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo, useState } from "react";
import { mutate } from "swr";
// plane imports
import { Dialog, DialogContent } from "@makeplane/propel/components/dialog";
import { setToast } from "@plane/blocks/toast";
import { APITokenService } from "@plane/services";
import type { IApiToken } from "@plane/types";
import { renderFormattedDate, csvDownload } from "@plane/utils";
// constants
import { API_TOKENS_LIST } from "@plane/constants";
// local imports
import { CreateApiTokenForm } from "./form";
import { GeneratedTokenDetails } from "./generated-token-details";
import { translate } from "@plane/i18n";

type Props = {
  workspaceSlug?: string;
  isOpen: boolean;
  onClose: () => void;
};

// services

const downloadSecretKey = (data: IApiToken) => {
  const csvData = {
    Title: data.label,
    Description: data.description,
    Expiry: data.expired_at ? (renderFormattedDate(data.expired_at)?.replace(",", " ") ?? "") : "Never expires",
    "Secret key": data.token ?? "",
  };

  csvDownload(csvData, `secret-key-${Date.now()}`);
};

export function CreateApiTokenModal(props: Props) {
  const { isOpen, onClose, workspaceSlug } = props;
  const apiTokenService = useMemo(() => new APITokenService(undefined, workspaceSlug), [workspaceSlug]);
  const cacheKey = workspaceSlug ? `${API_TOKENS_LIST}:${workspaceSlug}` : API_TOKENS_LIST;
  // states
  const [generatedToken, setGeneratedToken] = useState<IApiToken | null | undefined>(null);

  const handleClose = () => {
    onClose();

    setTimeout(() => {
      setGeneratedToken(null);
    }, 350);
  };

  const handleCreateToken = async (data: Partial<IApiToken>) => {
    // make the request to generate the token
    await apiTokenService
      .create(data)
      .then((res) => {
        setGeneratedToken(res);
        if (!workspaceSlug) downloadSecretKey(res);

        mutate<IApiToken[]>(
          cacheKey,
          (prevData) => {
            if (!prevData) return;

            const { token: _secret, ...metadata } = res;
            return [metadata, ...prevData];
          },
          false
        );
        return undefined;
      })
      .catch((err) => {
        setToast({
          type: "error",
          title: translate("toast.error"),
          message: err.message || err.detail,
        });

        throw err;
      });
  };

  return (
    /* Dismissed only through its own buttons, matching the modal it replaces, whose `handleClose`
       was a no-op. */
    <Dialog open={isOpen} disablePointerDismissal onOpenChange={() => {}}>
      <DialogContent size="md">
        {generatedToken ? (
          <GeneratedTokenDetails
            handleClose={handleClose}
            tokenDetails={generatedToken}
            showMcpSetup={!workspaceSlug}
          />
        ) : (
          <CreateApiTokenForm handleClose={handleClose} onSubmit={handleCreateToken} />
        )}
      </DialogContent>
    </Dialog>
  );
}
