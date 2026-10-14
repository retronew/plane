/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState, useRef } from "react";
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
import { ProfileSettingsHeading } from "@/components/settings/profile/heading";
import { APITokenSettingsLoader } from "@/components/ui/loader/settings/api-token";
// constants
import { API_TOKENS_LIST } from "@plane/constants";

const apiTokenService = new APITokenService();

export const APITokensProfileSettings = observer(function APITokensProfileSettings() {
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  // states
  const [isCreateTokenModalOpen, setIsCreateTokenModalOpen] = useState(false);
  // store hooks
  const { data: tokens } = useSWR(API_TOKENS_LIST, () => apiTokenService.list());
  // translation
  const { t } = useTranslation();

  if (!tokens) {
    return <APITokenSettingsLoader />;
  }

  const filteredTokens = tokens.filter((token) =>
    `${token.label} ${token.description}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
  );

  return (
    <div className="size-full">
      <CreateApiTokenModal isOpen={isCreateTokenModalOpen} onClose={() => setIsCreateTokenModalOpen(false)} />
      <ProfileSettingsHeading
        title={t("account_settings.api_tokens.title")}
        description={t("account_settings.api_tokens.description")}
      />
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
        <Button
          variant="primary"
          size="md"
          stretch="auto"
          label={t("workspace_settings.settings.api_tokens.add_token")}
          onClick={() => setIsCreateTokenModalOpen(true)}
        />
      </div>
      <div className="mt-4">
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
                  <th scope="col" className="px-3 py-2 font-medium">
                    {t("name")}
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    {t("web.status")}
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    {t("web.created_at")}
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    {t("web.token_expiration")}
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    {t("web.token_last_used")}
                  </th>
                  <th scope="col">
                    <span className="sr-only">{t("common.options")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredTokens.map((token) => (
                  <ApiTokenListItem key={token.id} token={token} />
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
            title={t("settings_empty_state.tokens.title")}
            description={t("settings_empty_state.tokens.description")}
            actions={[
              {
                label: t("settings_empty_state.tokens.cta_primary"),
                onClick: () => {
                  setIsCreateTokenModalOpen(true);
                },
              },
            ]}
            align="start"
            rootClassName="py-20"
          />
        )}
      </div>
    </div>
  );
});
