/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo, useState, useRef } from "react";
import type { ReactNode } from "react";
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
import type { IApiToken } from "@plane/types";
// components
import { CreateApiTokenModal } from "@/components/api-token/modal/create-token-modal";
import { ApiTokenListItem } from "@/components/api-token/token-list-item";
import { SettingsHeading } from "@/components/settings/heading";
import { ProfileSettingsHeading } from "@/components/settings/profile/heading";
import { APITokenSettingsLoader } from "@/components/ui/loader/settings/api-token";
// constants
import { API_TOKENS_LIST } from "@plane/constants";

type Translate = ReturnType<typeof useTranslation>["t"];

function TokensErrorState({ onRetry, t }: { onRetry: () => void; t: Translate }) {
  return (
    <div className="space-y-3">
      <p className="text-13 text-secondary">{t("web.token_load_failed")}</p>
      <Button size="md" stretch="auto" variant="secondary" label={t("web.retry_token_load")} onClick={onRetry} />
    </div>
  );
}

function TokenSearch({
  query,
  onQueryChange,
  showAdd,
  addButton,
  t,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  showAdd: boolean;
  addButton: ReactNode;
  t: Translate;
}) {
  const searchRef = useRef<HTMLInputElement>(null);

  return (
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
                  onQueryChange("");
                  searchRef.current?.focus();
                }}
              />
            ) : undefined
          }
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={t("web.search_access_tokens")}
          aria-label={t("web.search_access_tokens")}
          startIcon={<Icon icon={SearchOutline} />}
        />
      </div>
      {showAdd && addButton}
    </div>
  );
}

function TokensTable({ tokens, workspaceSlug, t }: { tokens: IApiToken[]; workspaceSlug?: string; t: Translate }) {
  return (
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
          {tokens.map((token) => (
            <ApiTokenListItem key={token.id} token={token} workspaceSlug={workspaceSlug} />
          ))}
          {tokens.length === 0 && (
            <tr>
              <td colSpan={6} className="p-6 text-center text-secondary">
                {t("common.search.no_matches_found")}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function TokensEmptyState({ isWorkspace, onCreate, t }: { isWorkspace: boolean; onCreate: () => void; t: Translate }) {
  return (
    <EmptyStateCompact
      assetKey="token"
      assetClassName="size-20"
      title={t(isWorkspace ? "web.workspace_tokens_empty" : "settings_empty_state.tokens.title")}
      description={t("settings_empty_state.tokens.description")}
      actions={isWorkspace ? [] : [{ label: t("settings_empty_state.tokens.cta_primary"), onClick: onCreate }]}
      align={isWorkspace ? "center" : "start"}
      className={isWorkspace ? "max-w-none" : undefined}
      rootClassName={isWorkspace ? "min-h-60 rounded-lg border border-subtle px-6 py-10" : "py-20"}
    />
  );
}

export const APITokensProfileSettings = observer(function APITokensProfileSettings({
  workspaceSlug,
}: {
  workspaceSlug?: string;
}) {
  const apiTokenService = useMemo(() => new APITokenService(undefined, workspaceSlug), [workspaceSlug]);
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

  if (error) return <TokensErrorState onRetry={() => void mutate()} t={t} />;

  if (!tokens) return <APITokenSettingsLoader />;

  const filteredTokens = tokens.filter((token) =>
    `${token.label} ${token.description}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
  );
  const openCreate = () => setIsCreateTokenModalOpen(true);
  const isWorkspace = Boolean(workspaceSlug);
  const addTokenButton = (
    <Button
      variant="primary"
      size="md"
      stretch="auto"
      label={t("workspace_settings.settings.api_tokens.add_token")}
      onClick={openCreate}
    />
  );

  return (
    <div className="size-full">
      <CreateApiTokenModal
        workspaceSlug={workspaceSlug}
        isOpen={isCreateTokenModalOpen}
        onClose={() => setIsCreateTokenModalOpen(false)}
      />
      {isWorkspace ? (
        <SettingsHeading
          title={t("web.workspace_tokens_title")}
          description={t("web.workspace_tokens_description")}
          control={addTokenButton}
        />
      ) : (
        <ProfileSettingsHeading
          title={t("account_settings.api_tokens.title")}
          description={t("account_settings.api_tokens.description")}
        />
      )}
      {(!isWorkspace || tokens.length > 0) && (
        <TokenSearch query={query} onQueryChange={setQuery} showAdd={!isWorkspace} addButton={addTokenButton} t={t} />
      )}
      <div className={isWorkspace && tokens.length === 0 ? "mt-6" : "mt-4"}>
        {tokens.length > 0 ? (
          <TokensTable tokens={filteredTokens} workspaceSlug={workspaceSlug} t={t} />
        ) : (
          <TokensEmptyState isWorkspace={isWorkspace} onCreate={openCreate} t={t} />
        )}
      </div>
    </div>
  );
});
