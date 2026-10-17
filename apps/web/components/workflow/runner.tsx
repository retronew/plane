import { useId, useState } from "react";
import useSWR from "swr";
import useSWRInfinite from "swr/infinite";
import { History, Plus, Trash2 } from "lucide-react";
import { Button } from "@makeplane/propel/components/button";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { InputField } from "@makeplane/propel/components/input-field";
import { setToast } from "@plane/blocks/toast";
import { ConfirmDialog } from "@plane/blocks/dialog";
import { useTranslation } from "@plane/i18n";
import type { TWorkflowExecution, TWorkflowScript, TWorkflowScriptVersion } from "@plane/types";
import { useProjectWorkflow } from "@/hooks/store/use-project-workflow";
import { getWorkflowErrorCode } from "@/helpers/workflow";
import { ScriptEditor } from "./script-editor";

const CAPABILITIES = [
  "getWorkItem",
  "addComment",
  "addLabels",
  "removeLabels",
  "updateWorkItem",
  "createWorkItem",
  "http",
];
const latestVersion = (script: TWorkflowScript) =>
  script.versions.reduce<TWorkflowScript["versions"][number] | undefined>(
    (latest, version) => (!latest || version.version > latest.version ? version : latest),
    undefined
  );
const TEMPLATES = {
  pre: "// Read context.proposed and return a decision.\nreturn { success: true };",
  post: "// SDK calls return promises. Tests only produce a dry-run action plan.\nif (context.work_item) {\n  await sdk.addComment(context.work_item.id, 'Workflow completed');\n}\nreturn { success: true };",
};

export function WorkflowRunResult({ run }: { run: TWorkflowExecution }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3 rounded-md border border-subtle p-3 text-body-xs-regular" aria-live="polite">
      <div className="flex flex-wrap gap-3">
        <strong>{t(`web.workflow_runner.status.${run.status}`)}</strong>
        {run.dry_run && <span>{t("web.workflow_runner.dry_run")}</span>}
        {run.attempt != null && <span>{t("web.workflow_runner.attempt", { count: run.attempt })}</span>}
      </div>
      {run.draft_hash && (
        <p className="text-caption-md-regular break-all text-tertiary">
          {t("web.workflow_runner.draft_hash", { hash: run.draft_hash })}
        </p>
      )}
      {!!run.error && (
        <pre className="max-h-48 overflow-auto break-words whitespace-pre-wrap text-danger-primary">
          {JSON.stringify(run.error, null, 2)}
        </pre>
      )}
      {(["logs", "steps", "actions"] as const).map(
        (key) =>
          !!run[key]?.length && (
            <details key={key} open={key === "logs"}>
              <summary className="cursor-pointer text-secondary">{t(`web.workflow_runner.${key}`)}</summary>
              <pre className="font-mono mt-2 max-h-64 overflow-auto rounded bg-layer-1 p-2 text-caption-md-regular break-words whitespace-pre-wrap">
                {JSON.stringify(run[key], null, 2)}
              </pre>
            </details>
          )
      )}
    </div>
  );
}

export function WorkflowExecutions({
  workspaceSlug,
  projectId,
  workflowId,
}: {
  workspaceSlug: string;
  projectId: string;
  workflowId?: string;
}) {
  const store = useProjectWorkflow(projectId),
    { t } = useTranslation();
  const [selected, setSelected] = useState<TWorkflowExecution | null>(null),
    [busy, setBusy] = useState(false);
  const [resolution, setResolution] = useState<"completed" | "abandoned" | null>(null),
    [resolutionOpen, setResolutionOpen] = useState(false),
    [note, setNote] = useState("");
  const resolve = async () => {
    if (!selected || !resolution || !note.trim()) return;
    setBusy(true);
    try {
      setSelected(
        await store.service.resolveExecution(workspaceSlug, projectId, selected.id, { resolution, note: note.trim() })
      );
      setResolutionOpen(false);
      setNote("");
      await mutate();
    } catch {
      setToast({ type: "error", title: t("error"), message: t("web.workflow_runner.resolve_failed") });
    } finally {
      setBusy(false);
    }
  };
  const {
    data,
    error: loadError,
    isValidating,
    size,
    setSize,
    mutate,
  } = useSWRInfinite(
    (index, previous: { next_offset: number | null } | null) =>
      previous?.next_offset === null
        ? null
        : ["workflow-executions", workspaceSlug, projectId, index === 0 ? 0 : (previous?.next_offset ?? 0), workflowId],
    ([, slug, project, offset, workflow]: [string, string, string, number, string | undefined]) =>
      store.service.executions(slug, project, offset, workflow),
    { revalidateFirstPage: true }
  );
  const inspect = async (id: string) => {
    setBusy(true);
    try {
      setSelected(await store.service.execution(workspaceSlug, projectId, id));
    } catch {
      setToast({ type: "error", title: t("error"), message: t("web.workflow_runner.load_failed") });
    } finally {
      setBusy(false);
    }
  };
  const retry = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      setSelected(await store.service.retry(workspaceSlug, projectId, selected.id));
      await mutate();
    } catch (error) {
      const code = getWorkflowErrorCode(error);
      setToast({
        type: "error",
        title: t("error"),
        message: code ? t(`web.workflow_errors.${code}`) : t("web.workflow_runner.retry_failed"),
      });
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="flex items-center gap-2 text-body-sm-medium">
          <History className="size-4" />
          {t("web.workflow_runner.executions")}
        </h4>
        <Button
          stretch="auto"
          variant="ghost"
          size="sm"
          label={t("web.workflow_runner.refresh")}
          onClick={() => void mutate()}
        />
      </div>
      {loadError && (
        <Button stretch="auto" variant="ghost" size="sm" label={t("common.retry")} onClick={() => void mutate()} />
      )}
      <div className="divide-y divide-subtle rounded-md border border-subtle">
        {(data ?? [])
          .flatMap((page) => page.results)
          .map((run) => (
            <button
              key={run.id}
              type="button"
              className="flex w-full flex-wrap items-center gap-3 px-3 py-2 text-left text-body-xs-regular hover:bg-layer-1"
              onClick={() => void inspect(run.id)}
              disabled={busy}
            >
              <span>{t(`web.workflow_runner.status.${run.status}`)}</span>
              <span className="text-secondary">
                {t(run.phase === "pre" ? "web.workflow_runner.pre" : "web.workflow_runner.post")}
              </span>
              {run.dry_run && <span className="text-tertiary">{t("web.workflow_runner.dry_run")}</span>}
              {run.created_at && (
                <time className="ml-auto text-tertiary" dateTime={run.created_at}>
                  {new Date(run.created_at).toLocaleString()}
                </time>
              )}
            </button>
          ))}
      </div>
      {!isValidating && !loadError && !data?.[0]?.results.length && (
        <p className="text-body-xs-regular text-tertiary">{t("web.workflow_runner.no_runs")}</p>
      )}
      {data?.at(-1)?.next_offset != null && (
        <Button
          stretch="auto"
          variant="ghost"
          size="sm"
          label={t("load_more")}
          onClick={() => void setSize(size + 1)}
        />
      )}
      {selected && (
        <>
          <WorkflowRunResult run={selected} />
          {selected.can_retry === true && (
            <Button
              stretch="auto"
              variant="secondary"
              size="sm"
              disabled={busy}
              label={t("web.workflow_runner.retry_run")}
              onClick={() => void retry()}
            />
          )}
          {selected.status === "unknown" && (
            <div className="space-y-3">
              <p className="text-body-xs-regular text-secondary">{t("web.workflow_runner.unknown_hint")}</p>
              <InputField
                orientation="vertical"
                size="md"
                label={t("web.workflow_runner.resolution_note")}
                value={note}
                disabled={busy}
                onChange={(event) => setNote(event.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  stretch="auto"
                  size="sm"
                  variant="secondary"
                  disabled={busy || !note.trim()}
                  label={t("web.workflow_runner.confirm_completed")}
                  onClick={() => {
                    setResolution("completed");
                    setResolutionOpen(true);
                  }}
                />
                <Button
                  stretch="auto"
                  size="sm"
                  variant="secondary"
                  disabled={busy || !note.trim()}
                  label={t("web.workflow_runner.confirm_abandoned")}
                  onClick={() => {
                    setResolution("abandoned");
                    setResolutionOpen(true);
                  }}
                />
              </div>
            </div>
          )}
        </>
      )}
      <ConfirmDialog
        isOpen={resolutionOpen}
        handleClose={() => setResolutionOpen(false)}
        handleSubmit={resolve}
        isSubmitting={busy}
        title={t(
          resolution === "completed" ? "web.workflow_runner.confirm_completed" : "web.workflow_runner.confirm_abandoned"
        )}
        content={t("web.workflow_runner.resolve_confirm")}
      />
    </section>
  );
}

export function WorkflowRunner({ workspaceSlug, projectId }: { workspaceSlug: string; projectId: string }) {
  const sourceId = useId();
  const testContextId = useId();
  const store = useProjectWorkflow(projectId),
    { t } = useTranslation();
  const {
    data: scripts = [],
    error: loadError,
    mutate,
  } = useSWR(["workflow-scripts", workspaceSlug, projectId], () => store.service.scripts(workspaceSlug, projectId));
  const { data: credentials = [], mutate: refreshCredentials } = useSWR(
    ["workflow-credentials", workspaceSlug, projectId],
    () => store.service.credentials(workspaceSlug, projectId)
  );
  const [scriptId, setScriptId] = useState(""),
    [name, setName] = useState(""),
    [description, setDescription] = useState(""),
    [source, setSource] = useState(TEMPLATES.pre),
    [capabilities, setCapabilities] = useState<string[]>([]);
  const [origins, setOrigins] = useState(""),
    [methods, setMethods] = useState("GET"),
    [credentialId, setCredentialId] = useState(""),
    [phase, setPhase] = useState<"pre" | "post">("pre"),
    [issueId, setIssueId] = useState(""),
    [testContext, setTestContext] = useState("{}"),
    [busy, setBusy] = useState(false),
    [testResult, setTestResult] = useState<TWorkflowExecution | null>(null),
    [testedSource, setTestedSource] = useState("");
  const [credential, setCredential] = useState({ name: "", secret: "", header_name: "Authorization", origin: "" });
  const selected = scripts.find((script) => script.id === scriptId);
  const loadVersion = (script: TWorkflowScript, version?: TWorkflowScriptVersion) => {
    setScriptId(script.id);
    setName(script.name);
    setDescription(script.description);
    setSource(version?.source ?? "");
    setCapabilities(version?.capabilities ?? []);
    setOrigins(version?.http_policy?.origins.join("\n") ?? "");
    setMethods(version?.http_policy?.methods.join(", ") ?? "GET");
    setCredentialId(version?.http_policy?.credential_id ?? "");
    setTestResult(null);
  };
  const http_policy = {
    origins: origins
      .split(/[\n,]/)
      .map((value) => value.trim())
      .filter(Boolean),
    methods: methods
      .split(",")
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean),
    ...(credentialId ? { credential_id: credentialId } : {}),
  };
  const fingerprint = JSON.stringify({ source, phase, capabilities, http_policy, issueId, testContext });
  const perform = async (operation: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await operation();
    } catch (error) {
      const code = getWorkflowErrorCode(error);
      setToast({
        type: "error",
        title: t("error"),
        message: code ? t(`web.workflow_errors.${code}`) : t("web.workflow_runner.save_failed"),
      });
    } finally {
      setBusy(false);
    }
  };
  const publish = () =>
    perform(async () => {
      const payload = { source, capabilities, http_policy };
      if (scriptId) await store.service.publishVersion(workspaceSlug, projectId, scriptId, payload);
      else {
        const script = await store.service.createScript(workspaceSlug, projectId, { name, description, ...payload });
        setScriptId(script.id);
      }
      await mutate();
      setToast({ type: "success", title: t("web.workflow_runner.published") });
    });
  const test = () =>
    perform(async () => {
      const context: unknown = JSON.parse(testContext);
      if (!context || typeof context !== "object" || Array.isArray(context)) throw new Error("Invalid context");
      const result = await store.service.testScript(workspaceSlug, projectId, {
        source,
        phase,
        capabilities,
        http_policy,
        ...(issueId.trim() ? { issue_id: issueId.trim() } : {}),
        context: context as Record<string, unknown>,
      });
      setTestResult(result);
      setTestedSource(fingerprint);
    });
  return (
    <div className="mt-8 space-y-8 text-primary">
      <section className="space-y-4 rounded-lg border border-subtle p-4">
        {loadError && (
          <Button stretch="auto" size="sm" variant="ghost" label={t("common.retry")} onClick={() => void mutate()} />
        )}
        <div className="flex flex-wrap items-center gap-2">
          {scripts.map((script) => (
            <Button
              stretch="auto"
              key={script.id}
              size="sm"
              variant={scriptId === script.id ? "secondary" : "ghost"}
              label={script.name}
              onClick={() => loadVersion(script, latestVersion(script))}
            />
          ))}
          <Button
            stretch="auto"
            size="sm"
            variant="ghost"
            icon={<Plus className="size-3.5" />}
            label={t("web.workflow_runner.new_script")}
            onClick={() => {
              setScriptId("");
              setName("");
              setDescription("");
              setSource(TEMPLATES.pre);
              setCapabilities([]);
              setOrigins("");
              setMethods("GET");
              setCredentialId("");
              setTestResult(null);
            }}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <InputField
            orientation="vertical"
            size="md"
            label={t("name")}
            value={name}
            disabled={busy || !!scriptId}
            onChange={(event) => setName(event.target.value)}
          />
          <InputField
            orientation="vertical"
            size="md"
            label={t("description")}
            value={description}
            disabled={busy || !!scriptId}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        {selected && (
          <label className="block space-y-2 text-body-xs-medium">
            {t("web.workflow_runner.versions")}
            <select
              className="block w-full rounded border border-subtle bg-layer-1 p-2"
              aria-label={t("web.workflow_runner.versions")}
              onChange={(event) =>
                loadVersion(
                  selected,
                  selected.versions.find((version) => version.id === event.target.value)
                )
              }
              defaultValue={latestVersion(selected)?.id}
              key={selected.id + selected.versions.length}
            >
              {selected.versions.map((version) => (
                <option key={version.id} value={version.id}>
                  v{version.version} · {new Date(version.created_at).toLocaleString()}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            stretch="auto"
            size="sm"
            variant="ghost"
            label={t("web.workflow_runner.template_pre")}
            disabled={busy}
            onClick={() => {
              setSource(TEMPLATES.pre);
              setPhase("pre");
            }}
          />
          <Button
            stretch="auto"
            size="sm"
            variant="ghost"
            label={t("web.workflow_runner.template_post")}
            disabled={busy}
            onClick={() => {
              setSource(TEMPLATES.post);
              setPhase("post");
              setCapabilities(["addComment"]);
            }}
          />
        </div>
        <label htmlFor={sourceId} className="block space-y-2 text-body-xs-medium">
          {t("web.workflow_runner.source")}
          <ScriptEditor
            id={sourceId}
            aria-label={t("web.workflow_runner.source")}
            language="javascript"
            disabled={busy}
            value={source}
            onChange={setSource}
          />
        </label>
        <fieldset disabled={busy} className="space-y-2">
          <legend className="mb-2 text-body-xs-medium">{t("web.workflow_runner.capabilities")}</legend>
          <div className="flex flex-wrap gap-3">
            {CAPABILITIES.map((capability) => (
              <label key={capability} className="flex items-center gap-2 text-body-xs-regular">
                <input
                  type="checkbox"
                  checked={capabilities.includes(capability)}
                  onChange={(event) =>
                    setCapabilities((values) =>
                      event.target.checked ? [...values, capability] : values.filter((value) => value !== capability)
                    )
                  }
                />
                {capability}
              </label>
            ))}
          </div>
        </fieldset>
        {capabilities.includes("http") && (
          <div className="space-y-3 rounded-md border border-subtle p-3">
            <p className="text-caption-md-regular text-secondary">{t("web.workflow_runner.http_hint")}</p>
            <InputField
              orientation="vertical"
              size="md"
              label={t("web.workflow_runner.origins")}
              value={origins}
              disabled={busy}
              onChange={(event) => setOrigins(event.target.value)}
            />
            <InputField
              orientation="vertical"
              size="md"
              label={t("web.workflow_runner.methods")}
              value={methods}
              disabled={busy}
              onChange={(event) => setMethods(event.target.value)}
            />
            <label className="block text-body-xs-regular">
              {t("web.workflow_runner.credential")}
              <select
                className="ml-2 rounded border border-subtle bg-layer-1 p-2"
                value={credentialId}
                disabled={busy}
                onChange={(event) => setCredentialId(event.target.value)}
              >
                <option value="">{t("common.none")}</option>
                {credentials.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name} · {item.origin}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        <div className="space-y-3 rounded-md bg-layer-1 p-3">
          <h5 className="text-body-xs-medium">{t("web.workflow_runner.test")}</h5>
          <label className="block text-body-xs-regular">
            {t("web.workflow_runner.phase")}
            <select
              className="ml-2 rounded border border-subtle bg-layer-2 p-2"
              value={phase}
              disabled={busy}
              onChange={(event) => setPhase(event.target.value as "pre" | "post")}
            >
              <option value="pre">{t("web.workflow_runner.pre")}</option>
              <option value="post">{t("web.workflow_runner.post")}</option>
            </select>
          </label>
          <InputField
            orientation="vertical"
            size="md"
            label={t("web.workflow_runner.test_issue")}
            value={issueId}
            disabled={busy}
            onChange={(event) => setIssueId(event.target.value)}
          />
          <label htmlFor={testContextId} className="block text-body-xs-regular">
            {t("web.workflow_runner.test_context")}
            <div className="mt-2">
              <ScriptEditor
                id={testContextId}
                aria-label={t("web.workflow_runner.test_context")}
                language="json"
                compact
                value={testContext}
                disabled={busy}
                onChange={setTestContext}
              />
            </div>
          </label>
          <p className="text-caption-md-regular text-tertiary">{t("web.workflow_runner.test_hint")}</p>
          <Button
            stretch="auto"
            size="sm"
            variant="secondary"
            disabled={busy || !source.trim()}
            label={t("web.workflow_runner.run_test")}
            onClick={() => void test()}
          />
          {testResult && (
            <>
              {testedSource !== fingerprint && (
                <p className="text-body-xs-regular text-secondary">{t("web.workflow_runner.test_stale")}</p>
              )}
              <WorkflowRunResult run={testResult} />
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-caption-md-regular text-secondary">{t("web.workflow_runner.immutable_hint")}</p>
          <Button
            stretch="auto"
            size="md"
            variant="primary"
            disabled={busy || !source.trim() || !name.trim()}
            label={t("web.workflow_runner.publish")}
            onClick={() => void publish()}
          />
          {selected && (
            <IconButton
              size="sm"
              variant="ghost"
              disabled={busy}
              aria-label={t("delete")}
              icon={<Trash2 className="size-4" />}
              onClick={() =>
                void perform(async () => {
                  await store.service.deleteScript(workspaceSlug, projectId, selected.id);
                  setScriptId("");
                  await mutate();
                })
              }
            />
          )}
        </div>
      </section>
      <details className="rounded-lg border border-subtle p-4">
        <summary className="cursor-pointer text-body-sm-medium">{t("web.workflow_runner.credentials")}</summary>
        <div className="mt-4 space-y-3">
          <p className="text-caption-md-regular text-secondary">{t("web.workflow_runner.credentials_hint")}</p>
          {credentials.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-2 text-body-xs-regular">
              <p>
                {item.name} · {item.origin} · {item.header_name}
              </p>
              <IconButton
                size="sm"
                variant="ghost"
                disabled={busy}
                aria-label={t("web.workflow_runner.revoke_credential")}
                icon={<Trash2 className="size-3.5" />}
                onClick={() =>
                  void perform(async () => {
                    await store.service.deleteCredential(workspaceSlug, projectId, item.id);
                    if (credentialId === item.id) setCredentialId("");
                    await refreshCredentials();
                  })
                }
              />
            </div>
          ))}
          {(["name", "origin", "header_name", "secret"] as const).map((key) => (
            <InputField
              orientation="vertical"
              key={key}
              size="md"
              label={t(`web.workflow_runner.credential_${key}`)}
              type={key === "secret" ? "password" : "text"}
              autoComplete="off"
              value={credential[key]}
              disabled={busy}
              onChange={(event) => setCredential({ ...credential, [key]: event.target.value })}
            />
          ))}
          <Button
            stretch="auto"
            size="sm"
            variant="secondary"
            label={t("web.workflow_runner.add_credential")}
            disabled={busy || Object.values(credential).some((value) => !value.trim())}
            onClick={() =>
              void perform(async () => {
                await store.service.createCredential(workspaceSlug, projectId, credential);
                setCredential({ name: "", secret: "", header_name: "Authorization", origin: "" });
                await refreshCredentials();
              })
            }
          />
        </div>
      </details>
    </div>
  );
}
