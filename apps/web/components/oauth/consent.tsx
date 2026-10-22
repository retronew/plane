import { useState } from "react";
import type { ReactNode } from "react";
import useSWR from "swr";
import { Button } from "@makeplane/propel/components/button";
import { Checkbox } from "@makeplane/propel/components/checkbox";
import { API_BASE_URL } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Check, ShieldCheck, ArrowRight, Plug } from "lucide-react";
import { returnToMcpClient } from "@/helpers/mcp-connect";
import planeIcon from "@/app/assets/icons/icon-180x180.png?url";

type Consent = {
  ticket: string;
  csrf_token: string;
  client_name: string;
  account_email: string;
  redirect_uri: string;
  write_requested: boolean;
  grant_days?: number;
};
const endpoint = `${API_BASE_URL}/auth/mcp/authorize/`;

export function OAuthCard({ children }: { children: ReactNode }) {
  const { t, currentLocale, languages, changeLanguage } = useTranslation();
  return (
    <div className="flex h-full w-full flex-col items-center overflow-y-auto bg-canvas px-4 py-8 sm:py-16">
      <div className="my-auto w-full max-w-[420px] space-y-5">
        <div className="flex items-center justify-center gap-2 text-body-sm-medium">
          <img src={planeIcon} alt="" className="size-6" />
          Plane
        </div>
        <section className="shadow-sm rounded-xl border border-subtle bg-surface-1 p-6 sm:p-8">{children}</section>
        <div className="flex flex-wrap items-center justify-center gap-4 text-caption-sm-regular text-tertiary">
          <a href="/settings/profile/oauth-connections/" className="underline underline-offset-4">
            {t("account_settings.oauth.title")}
          </a>
          <select
            className="max-w-40 rounded-sm bg-transparent py-1 text-secondary focus-visible:outline-2 focus-visible:outline-offset-2"
            aria-label={t("account_settings.oauth.language")}
            value={currentLocale}
            onChange={(event) => changeLanguage(event.target.value as typeof currentLocale)}
          >
            {languages.map((language) => (
              <option key={language.value} value={language.value}>
                {language.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

export function OAuthConsent({ flow }: { flow: string | null }) {
  const { t } = useTranslation();
  const tr = (key: string, params?: Record<string, unknown>) => t(`account_settings.oauth.${key}`, params);
  const valid = flow !== null && /^[A-Za-z0-9_-]{43}$/.test(flow);
  const { data, error, mutate } = useSWR<Consent>(
    valid ? `${API_BASE_URL}/auth/mcp/consent/?flow=${encodeURIComponent(flow)}` : null,
    async (url: string) => {
      const response = await fetch(url, {
        credentials: "include",
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok)
        throw new Error(
          response.status === 410 || response.status === 403 || response.status === 400 ? "expired" : "network"
        );
      return response.json();
    },
    { shouldRetryOnError: false, revalidateOnFocus: false }
  );
  const [write, setWrite] = useState(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [completed, setCompleted] = useState<{ decision: string; target: string } | null>(null);
  const [closeBlocked, setCloseBlocked] = useState(false);
  async function submit(decision: "allow" | "deny") {
    if (!data || pending) return;
    setPending(true);
    setFailed(false);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        signal: AbortSignal.timeout(15000),
        headers: { Accept: "application/json", "X-CSRFToken": data.csrf_token },
        body: new URLSearchParams({
          ticket: data.ticket,
          decision,
          write: write && data.write_requested ? "yes" : "no",
        }),
      });
      if (!response.ok) throw new Error("Consent failed");
      const result: { redirect_url: string } = await response.json();
      // The target is returned only after server-side exact registered callback validation.
      setCompleted({ decision, target: result.redirect_url });
      returnToMcpClient(result.redirect_url);
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }
  if (!valid || error)
    return (
      <OAuthCard>
        <h1 className="text-h5-medium">
          {tr(!valid || error?.message === "expired" ? "expired_title" : "load_error")}
        </h1>
        <p className="mt-3 text-body-sm-regular text-secondary">
          {tr(!valid || error?.message === "expired" ? "expired_hint" : "network_hint")}
        </p>
        <div className="mt-6">
          {!valid || error?.message === "expired" ? (
            <Button
              variant="secondary"
              size="md"
              stretch="full"
              label={tr("return_home")}
              render={<a href="/" aria-label={tr("return_home")} />}
            />
          ) : (
            <Button variant="secondary" size="md" stretch="full" label={tr("retry")} onClick={() => void mutate()} />
          )}
        </div>
      </OAuthCard>
    );
  if (!data)
    return (
      <OAuthCard>
        <output className="block text-body-sm-regular text-secondary">{tr("loading_consent")}</output>
      </OAuthCard>
    );
  if (completed)
    return (
      <OAuthCard>
        <ShieldCheck className="mb-4 size-8 text-success-primary" aria-hidden="true" />
        <h1 className="text-h5-medium">{tr(completed.decision === "allow" ? "returning" : "cancelled")}</h1>
        <p className="mt-3 text-body-sm-regular text-secondary">
          {tr(completed.decision === "allow" ? "returning_hint" : "cancelled_hint")}
        </p>
        <div className="mt-6 space-y-3">
          <Button
            variant="primary"
            size="md"
            stretch="full"
            label={tr("return_client")}
            onClick={() => returnToMcpClient(completed.target)}
          />
          <Button
            variant="secondary"
            size="md"
            stretch="full"
            label={tr("close")}
            onClick={() => {
              window.close();
              setCloseBlocked(true);
            }}
          />
        </div>
        {closeBlocked && <output className="mt-3 block text-body-xs-regular text-secondary">{tr("close_hint")}</output>}
      </OAuthCard>
    );
  return (
    <OAuthCard>
      <div className="mb-5 flex items-center justify-center gap-4" aria-hidden="true">
        <img src={planeIcon} alt="" className="size-10 rounded-lg" />
        <ArrowRight className="size-4 text-tertiary" />
        <div className="rounded-lg border border-subtle bg-layer-1 p-2">
          <Plug className="size-6 text-secondary" />
        </div>
      </div>
      <h1 className="text-center text-h5-medium break-words">{tr("connect_title", { client: data.client_name })}</h1>
      <p className="mt-2 text-center text-body-xs-regular break-all text-secondary">{data.account_email}</p>
      <div className="mt-6 space-y-4">
        <div className="flex gap-3">
          <Check className="mt-0.5 size-4 shrink-0 text-secondary" aria-hidden="true" />
          <div>
            <h2 className="text-body-sm-medium">{tr("account_scope")}</h2>
            <p className="mt-1 text-body-xs-regular text-secondary">{tr("consent_scope")}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Check className="mt-0.5 size-4 shrink-0 text-secondary" aria-hidden="true" />
          <div>
            <h2 className="text-body-sm-medium">{tr("read")}</h2>
            <p className="mt-1 text-body-xs-regular text-secondary">{tr("read_hint")}</p>
          </div>
        </div>
        {data.write_requested && (
          <div className="flex items-start gap-3 rounded-md border border-subtle p-3">
            <Checkbox
              id="oauth-write"
              checked={write}
              onCheckedChange={(checked) => setWrite(Boolean(checked))}
              disabled={pending}
            />
            <div>
              <label htmlFor="oauth-write" className="cursor-pointer text-body-xs-medium">
                {tr("allow_write")}
              </label>
              <p className="mt-1 text-caption-sm-regular text-secondary">{tr("write_hint")}</p>
            </div>
          </div>
        )}
      </div>
      <details className="mt-5 text-caption-sm-regular text-secondary">
        <summary className="cursor-pointer py-1 underline underline-offset-4">{tr("details")}</summary>
        <p className="mt-2">{tr("unverified_client")}</p>
        <p className="mt-2 break-all">{data.redirect_uri}</p>
      </details>
      <p className="mt-4 text-caption-sm-regular text-tertiary">
        {data.grant_days ? tr("consent_expiry", { days: data.grant_days }) : tr("consent_expiry_unknown")}
      </p>
      {failed && (
        <p role="alert" className="mt-3 text-body-xs-regular text-danger-primary">
          {tr("submit_error")}
        </p>
      )}
      <div className="mt-6 flex flex-wrap gap-3">
        <div className="min-w-24 flex-1">
          <Button
            variant="secondary"
            size="md"
            stretch="full"
            label={tr("cancel")}
            disabled={pending}
            onClick={() => void submit("deny")}
          />
        </div>
        <div className="min-w-32 flex-1">
          <Button
            variant="primary"
            size="md"
            stretch="full"
            label={tr("allow")}
            loading={pending}
            onClick={() => void submit("allow")}
          />
        </div>
      </div>
    </OAuthCard>
  );
}
