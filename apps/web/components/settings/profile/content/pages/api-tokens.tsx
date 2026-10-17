/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo, useState, useRef } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
// plane imports
import { useTranslation } from "@plane/i18n";
import { InputField } from "@makeplane/propel/components/input-field";
import { Icon } from "@makeplane/propel/components/icon";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { SearchOutline, CloseOutline } from "@makeplane/propel/icons";
import { Button } from "@makeplane/propel/components/button";
import { EmptyStateCompact } from "@plane/blocks/empty-state";
import { APITokenService } from "@plane/services";
// components
import { CreateApiTokenModal } from "@/components/api-token/modal/create-token-modal";
import { ApiTokenListItem } from "@/components/api-token/token-list-item";
import { SettingsHeading } from "@/components/settings/heading";
import { ProfileSettingsHeading } from "@/components/settings/profile/heading";
import { APITokenSettingsLoader } from "@/components/ui/loader/settings/api-token";
// constants
import { API_TOKENS_LIST } from "@plane/constants";

export const APITokensProfileSettings = observer(function APITokensProfileSettings({
  workspaceSlug,
}: {
  workspaceSlug?: string;
}) {
  const apiTokenService = useMemo(() => new APITokenService(undefined, workspaceSlug), [workspaceSlug]);
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  // states
  const [isCreateTokenModalOpen, setIsCreateTokenModalOpen] = useState(false);
  // store hooks
  const {
    data: tokens,
    error,
    mutate,
  } = useSWR(workspaceSlug ? `${API_TOKENS_LIST}:${workspaceSlug}` : API_TOKENS_LIST, () => apiTokenService.list());
  // translation
  const { t } = useTranslation();

  if (error)
    return (
      <div className="space-y-3">
        <p className="text-13 text-secondary">{t("web.token_load_failed")}</p>
        <Button
          size="md"
          stretch="auto"
          variant="secondary"
          label={t("web.retry_token_load")}
          onClick={() => void mutate()}
        />
      </div>
    );

  if (!tokens) {
    return <APITokenSettingsLoader />;
  }

  const filteredTokens = tokens.filter((token) =>
    `${token.label} ${token.description}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
  );

  const addTokenButton = (
    <Button
      variant="primary"
      size="md"
      stretch="auto"
      label={t("workspace_settings.settings.api_tokens.add_token")}
      onClick={() => setIsCreateTokenModalOpen(true)}
    />
  );

  return (
    <div className="size-full">
      <CreateApiTokenModal
        workspaceSlug={workspaceSlug}
        isOpen={isCreateTokenModalOpen}
        onClose={() => setIsCreateTokenModalOpen(false)}
      />
      {workspaceSlug && (
        <SettingsHeading
          title={t("web.workspace_tokens_title")}
          description={t("web.workspace_tokens_description")}
          control={addTokenButton}
        />
      )}
      {!workspaceSlug && (
        <ProfileSettingsHeading
          title={t("account_settings.api_tokens.title")}
          description={t("account_settings.api_tokens.description")}
        />
      )}
      {(!workspaceSlug || tokens.length > 0) && (
        <div className="mt-6 flex items-center justify-between gap-4">
          <div className="w-60 min-w-0">
            <InputField
              size="md"
              orientation="vertical"
              ref={searchRef}
              value={query}
              endIcon={
                query ? (
                  <IconButton
                    variant="ghost"
                    size="xs"
                    icon={<Icon icon={CloseOutline} />}
                    aria-label={t("web.clear_token_search")}
                    onClick={() => {
                      setQuery("");
                      searchRef.current?.focus();
                    }}
                  />
                ) : undefined
              }
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("web.search_access_tokens")}
              aria-label={t("web.search_access_tokens")}
              startIcon={<Icon icon={SearchOutline} />}
            />
          </div>
          {!workspaceSlug && addTokenButton}
        </div>
      )}
      <div className={workspaceSlug && tokens.length === 0 ? "mt-6" : "mt-4"}>
        {tokens.length > 0 ? (
          <div className="overflow-x-auto rounded-md border border-subtle">
            <table className="w-full min-w-[640px] table-fixed text-left text-body-xs-regular">
              <colgroup>
                <col />
                <col className="w-20" />
                <col className="w-30" />
                <col className="w-30" />
                <col className="w-24" />
                <col className="w-10" />
              </colgroup>
              <thead className="border-b border-subtle bg-layer-1 text-secondary">
                <tr>
                  <th scope="col" className="h-9 px-3 py-1 font-medium">
                    {t("name")}
                  </th>
                  <th scope="col" className="h-9 px-3 py-1 font-medium">
                    {t("web.status")}
                  </th>
                  <th scope="col" className="h-9 px-3 py-1 font-medium">
                    {t("web.created_at")}
                  </th>
                  <th scope="col" className="h-9 px-3 py-1 font-medium">
                    {t("web.token_expiration")}
                  </th>
                  <th scope="col" className="h-9 px-3 py-1 font-medium">
                    {t("web.token_last_used")}
                  </th>
                  <th scope="col" className="h-9 py-1">
                    <span className="sr-only">{t("common.options")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredTokens.map((token) => (
                  <ApiTokenListItem key={token.id} token={token} workspaceSlug={workspaceSlug} />
                ))}
                {filteredTokens.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-secondary">
                      {t("common.search.no_matches_found")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyStateCompact
            assetKey="token"
            assetClassName="size-20"
            title={t(workspaceSlug ? "web.workspace_tokens_empty" : "settings_empty_state.tokens.title")}
            description={t("settings_empty_state.tokens.description")}
            actions={
              workspaceSlug
                ? []
                : [
                    {
                      label: t("settings_empty_state.tokens.cta_primary"),
                      onClick: () => {
                        setIsCreateTokenModalOpen(true);
                      },
                    },
                  ]
            }
            align={workspaceSlug ? "center" : "start"}
            className={workspaceSlug ? "max-w-none" : undefined}
            rootClassName={workspaceSlug ? "min-h-60 rounded-lg border border-subtle px-6 py-10" : "py-20"}
          />
        )}
      </div>
    </div>
  );
});
