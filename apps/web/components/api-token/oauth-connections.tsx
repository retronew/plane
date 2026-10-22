import { useState } from "react";
import useSWR from "swr";
import { Button } from "@makeplane/propel/components/button";
import { API_BASE_URL } from "@plane/constants";
import { useTranslation } from "@plane/i18n";

type Connection = { id: string; client_name: string; workspace_name: string; scope: string; expires_at: string };
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
  const { t } = useTranslation();
  const { data, error, mutate } = useSWR(endpoint, loadConnections);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  async function revoke(id: string) {
    if (!data || pending) return;
    setPending(true);
    setFailed(false);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        signal: AbortSignal.timeout(15000),
        credentials: "include",
        headers: { "X-CSRFToken": data.csrf_token },
        body: new URLSearchParams({ grant: id }),
      });
      if (!response.ok) throw new Error("Unable to revoke OAuth connection");
      await mutate({ ...data, connections: data.connections.filter((item) => item.id !== id) }, { revalidate: false });
      setConfirm(null);
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="mt-8 space-y-4" aria-labelledby="oauth-connections-title">
      <h3 id="oauth-connections-title" className="text-16 font-medium">
        {t("account_settings.mcp.manage_connections")}
      </h3>
      <p className="text-13 text-secondary">{t("account_settings.mcp.oauth_description")}</p>
      {error ? (
        <div role="alert">
          <p>{t("account_settings.mcp.oauth_load_error")}</p>
          <Button
            variant="secondary"
            size="sm"
            stretch="auto"
            label={t("account_settings.mcp.oauth_retry")}
            onClick={() => void mutate()}
          />
        </div>
      ) : !data ? (
        <output>{t("account_settings.mcp.oauth_loading")}</output>
      ) : data.connections.length === 0 ? (
        <p className="text-13 text-secondary">{t("account_settings.mcp.oauth_empty")}</p>
      ) : (
        <ul className="space-y-3">
          {data.connections.map((item) => (
            <li key={item.id} className="space-y-2 rounded-md border border-subtle p-4">
              <p className="font-medium">{item.client_name}</p>
              <p className="text-13 text-secondary">
                {item.workspace_name} ·{" "}
                {t(
                  item.scope.split(" ").includes("plane:write")
                    ? "account_settings.mcp.oauth_write"
                    : "account_settings.mcp.oauth_read"
                )}
              </p>
              <p className="text-13 text-secondary">
                {t("account_settings.mcp.oauth_expires")}{" "}
                <time dateTime={item.expires_at}>{new Date(item.expires_at).toLocaleString()}</time>
              </p>
              {confirm === item.id ? (
                <div className="space-y-2">
                  <p>{t("account_settings.mcp.oauth_confirm")}</p>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      stretch="auto"
                      disabled={pending}
                      label={t("account_settings.mcp.oauth_confirm_revoke")}
                      onClick={() => void revoke(item.id)}
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      stretch="auto"
                      disabled={pending}
                      label={t("account_settings.mcp.oauth_cancel")}
                      onClick={() => {
                        setConfirm(null);
                        setFailed(false);
                      }}
                    />
                  </div>
                  {failed && <p role="alert">{t("account_settings.mcp.oauth_revoke_error")}</p>}
                </div>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  stretch="auto"
                  disabled={pending}
                  label={t("account_settings.mcp.oauth_revoke")}
                  onClick={() => {
                    setConfirm(item.id);
                    setFailed(false);
                  }}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
