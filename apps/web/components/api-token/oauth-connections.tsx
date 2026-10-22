import { useState } from "react";
import useSWR from "swr";
import { Button } from "@makeplane/propel/components/button";
import { InputField } from "@makeplane/propel/components/input-field";
import { Icon } from "@makeplane/propel/components/icon";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Menu, MenuTrigger, MenuItem } from "@makeplane/propel/components/menu";
import { SearchOutline, MoreHorizontalOutline } from "@makeplane/propel/icons";
import { ActionMenuContent } from "@plane/blocks/common";
import { ConfirmDialog } from "@plane/blocks/dialog";
import { API_BASE_URL } from "@plane/constants";
import { useTranslation } from "@plane/i18n";

type Connection = {
  id: string;
  client_name: string;
  workspace_name: string | null;
  scope: string;
  created_at: string;
  expires_at: string;
  status: "active" | "pending" | "expired";
};
type Connections = { csrf_token: string; connections: Connection[] };
const endpoint = `${API_BASE_URL}/auth/mcp/connections/`;
async function loadConnections(): Promise<Connections> {
  const response = await fetch(endpoint, {
    credentials: "include",
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("Unable to load OAuth connections");
  return response.json();
}

export function OAuthConnections() {
  const { t, currentLocale } = useTranslation();
  const { data, error, mutate } = useSWR(endpoint, loadConnections);
  const [query, setQuery] = useState("");
  const [confirm, setConfirm] = useState<{ item: Connection; reconnect: boolean } | null>(null);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const tr = (key: string) => t(`account_settings.oauth.${key}`);
  const date = (value: string) =>
    new Intl.DateTimeFormat(currentLocale, { dateStyle: "medium" }).format(new Date(value));
  async function revoke() {
    if (!data || !confirm || pending) return;
    setPending(true);
    setFailed(false);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        signal: AbortSignal.timeout(15000),
        credentials: "include",
        headers: { "X-CSRFToken": data.csrf_token },
        body: new URLSearchParams({ grant: confirm.item.id }),
      });
      // Another tab may already have revoked this exact grant.
      if (!response.ok && response.status !== 404) throw new Error("Unable to revoke OAuth connection");
      await mutate(
        { ...data, connections: data.connections.filter((item) => item.id !== confirm.item.id) },
        { revalidate: false }
      );
      setNotice(tr(confirm.reconnect ? "reconnect_next" : "revoked"));
      setConfirm(null);
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }
  const rows =
    data?.connections.filter((item) =>
      `${item.client_name} ${item.workspace_name ?? tr("account_scope")}`
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase())
    ) ?? [];
  return (
    <section className="mt-6 space-y-4" aria-label={tr("title")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="w-60 max-w-full">
          <InputField
            size="md"
            orientation="vertical"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={tr("search")}
            aria-label={tr("search")}
            startIcon={<Icon icon={SearchOutline} />}
          />
        </div>
        <Button variant="secondary" size="sm" stretch="auto" label={tr("refresh")} onClick={() => void mutate()} />
      </div>
      {notice && (
        <output className="block rounded-md bg-layer-1 p-3 text-body-xs-regular text-secondary">{notice}</output>
      )}
      {error ? (
        <div role="alert" className="space-y-3 rounded-md border border-subtle p-6">
          <p className="text-body-xs-regular text-secondary">{tr("load_error")}</p>
          <Button variant="secondary" size="sm" stretch="auto" label={tr("retry")} onClick={() => void mutate()} />
        </div>
      ) : !data ? (
        <output className="block py-8 text-body-xs-regular text-secondary">{tr("loading")}</output>
      ) : (
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Keyboard users must be able to scroll the wide table.
        <section className="overflow-x-auto rounded-md border border-subtle" tabIndex={0} aria-label={tr("table_hint")}>
          <table className="w-full min-w-[660px] text-start text-body-xs-regular">
            <thead className="border-b border-subtle bg-layer-1 text-secondary">
              <tr>
                {["client", "permissions", "status", "created", "expires"].map((key) => (
                  <th key={key} scope="col" className="h-9 px-3 py-1 text-start font-medium">
                    {tr(key)}
                  </th>
                ))}
                <th scope="col" className="px-2">
                  <span className="sr-only">{tr("actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.id} className="border-b border-subtle last:border-0 hover:bg-layer-1-hover">
                  <td className="max-w-60 px-3 py-3">
                    <p className="text-body-xs-medium break-words">{item.client_name}</p>
                    <p className="mt-1 text-caption-sm-regular break-words text-secondary">
                      {item.workspace_name ?? tr("account_scope")}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-secondary">
                    {tr(item.scope.split(" ").includes("plane:write") ? "write" : "read")}
                  </td>
                  <td className={`px-3 py-3 ${item.status === "active" ? "text-success-primary" : "text-secondary"}`}>
                    {tr(item.status)}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-secondary">
                    <time dateTime={item.created_at}>
                      {date(item.created_at)}
                      <span className="mt-1 block text-caption-sm-regular text-tertiary">
                        {new Intl.DateTimeFormat(currentLocale, { timeStyle: "medium" }).format(
                          new Date(item.created_at)
                        )}
                      </span>
                    </time>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-secondary">
                    <time dateTime={item.expires_at}>{date(item.expires_at)}</time>
                  </td>
                  <td className="px-2 py-2">
                    <Menu>
                      <MenuTrigger
                        render={
                          <IconButton
                            variant="ghost"
                            size="sm"
                            icon={<Icon icon={MoreHorizontalOutline} />}
                            aria-label={`${tr("actions")}: ${item.client_name}`}
                          />
                        }
                      />
                      <ActionMenuContent side="bottom" align="end">
                        <div className="min-w-40">
                          <MenuItem
                            label={tr("reconnect")}
                            onClick={() => {
                              setConfirm({ item, reconnect: true });
                              setFailed(false);
                            }}
                          />
                          <MenuItem
                            variant="danger"
                            label={tr("revoke")}
                            onClick={() => {
                              setConfirm({ item, reconnect: false });
                              setFailed(false);
                            }}
                          />
                        </div>
                      </ActionMenuContent>
                    </Menu>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-secondary">
                    <p>{tr(query ? "no_matches" : "empty")}</p>
                    {!query && <p className="mt-2 text-caption-sm-regular">{tr("empty_hint")}</p>}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}
      <p className="text-caption-sm-regular text-tertiary md:hidden">{tr("table_hint")}</p>
      <p className="text-caption-sm-regular text-tertiary">{tr("scope_hint")}</p>
      <ConfirmDialog
        isOpen={confirm !== null}
        isSubmitting={pending}
        variant={confirm?.reconnect ? "warning" : "danger"}
        title={tr(confirm?.reconnect ? "reconnect" : "revoke")}
        content={
          <>
            {confirm?.item.client_name}
            <br />
            {tr(confirm?.reconnect ? "reconnect_confirm" : "revoke_confirm")}
            {failed && (
              <span role="alert" className="mt-3 block text-danger-primary">
                {tr("revoke_error")}
              </span>
            )}
          </>
        }
        primaryButtonText={{ default: tr(confirm?.reconnect ? "reconnect_action" : "revoke"), loading: tr("revoking") }}
        secondaryButtonText={tr("cancel")}
        handleClose={() => {
          if (!pending) setConfirm(null);
        }}
        handleSubmit={revoke}
      />
    </section>
  );
}
