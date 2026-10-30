import { useState } from "react";
import { Button } from "@makeplane/propel/components/button";
import {
  Dialog,
  DialogContent,
  DialogMain,
  DialogHeader,
  DialogHeading,
  DialogTitle,
  DialogBody,
  DialogActions,
} from "@makeplane/propel/components/dialog";
import { useTranslation } from "@plane/i18n";
import type { IState } from "@plane/types";
import { ConfigurationSelect } from "@/components/settings/workspace/configuration/select";
import {
  workspaceConfigurationService as service,
  type StateTemplatePreview,
} from "@/services/workspace-configuration.service";

export function ApplyStateTemplate({
  workspaceSlug,
  projectId,
  states,
  onApplied,
}: {
  workspaceSlug: string;
  projectId: string;
  states: IState[];
  onApplied: () => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<StateTemplatePreview>();
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [stale, setStale] = useState(false);
  const fieldLabel = (key: string) => {
    switch (key) {
      case "name":
        return t("web.name");
      case "color":
        return t("web.color");
      case "group":
        return t("state");
      case "default":
        return t("web.default");
      case "allow_new_work_items":
        return t("web.allow_new_work_items");
      default:
        return key;
    }
  };
  const fieldValue = (key: string, value: unknown) => {
    if (typeof value === "boolean") return t(value ? "web.enabled" : "web.disabled");
    if (key === "group") return t(`web.template_state_${value as IState["group"]}`);
    return String(value);
  };
  const run = async (apply: boolean) => {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await service.stateTemplate(workspaceSlug, projectId, {
        mapping,
        ...(apply ? { apply: true, token: preview?.token } : {}),
      });
      if (apply) {
        await onApplied();
        setOpen(false);
      } else {
        setPreview(result);
        setStale(false);
      }
    } catch {
      setStale(true);
      setMessage(t("web.state_template_error"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button
          size="md"
          stretch="auto"
          variant="secondary"
          label={t("web.apply_state_template")}
          onClick={() => {
            setPreview(undefined);
            setMapping({});
            setMessage("");
            setStale(false);
            setOpen(true);
          }}
        />
      </div>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!busy) setOpen(value);
        }}
      >
        <DialogContent size="lg">
          <DialogMain>
            <DialogHeader>
              <DialogHeading>
                <DialogTitle>{t("web.apply_state_template")}</DialogTitle>
              </DialogHeading>
            </DialogHeader>
            <DialogBody>
              <p className="mb-4 text-13 text-secondary">{t("web.state_template_hint")}</p>
              {message && (
                <p role="alert" className="mb-3 text-13 text-danger-primary">
                  {message}
                </p>
              )}
              {preview && (
                <div className="flex flex-col gap-4">
                  <p className="text-14 font-medium">{preview.template}</p>
                  {preview.disabled_state_groups &&
                    ["backlog", "unstarted", "started", "completed", "cancelled"].map((group) => {
                      const before = !preview.disabled_state_groups!.before.includes(group);
                      const after = !preview.disabled_state_groups!.after.includes(group);
                      return before !== after ? (
                        <p key={group} className="text-13 text-secondary">
                          {t(`web.template_state_${group}`)} · {t("web.allow_new_work_items")}:{" "}
                          {fieldValue(group, before)} → {fieldValue(group, after)}
                        </p>
                      ) : null;
                    })}
                  {(["matched", "added"] as const).map((kind) => (
                    <section key={kind}>
                      <h3 className="mb-2 text-13 font-medium">
                        {t(kind === "matched" ? "web.state_template_matched" : "web.state_template_added")}
                      </h3>
                      {preview[kind].map((row) => (
                        <div key={row.index} className="mb-3 rounded border border-subtle p-3 text-13">
                          <p className="mb-2">
                            {row.values.name} · {t(`web.template_state_${row.values.group as IState["group"]}`)}
                          </p>
                          <ConfigurationSelect
                            value={mapping[String(row.index)] ?? row.id ?? "auto"}
                            placeholder={t("state")}
                            options={[
                              { value: "auto", label: t("web.state_template_preview") },
                              ...states
                                .filter((state) => state.group === row.values.group)
                                .map((state) => ({ value: state.id, label: state.name })),
                            ]}
                            onChange={(value) => {
                              setMapping((current) => {
                                const next = { ...current };
                                if (value === "auto") delete next[String(row.index)];
                                else next[String(row.index)] = value;
                                return next;
                              });
                              setStale(true);
                            }}
                          />
                          {kind === "added" &&
                            Object.entries(row.values).map(([key, value]) => (
                              <p key={key} className="mt-1 text-12 text-secondary">
                                {fieldLabel(key)}: {fieldValue(key, value)}
                              </p>
                            ))}
                          {"changes" in row &&
                            Object.entries(row.changes).map(([key, change]) => (
                              <p key={key} className="mt-1 text-12 text-secondary">
                                {fieldLabel(key)}: {fieldValue(key, change.before)} → {fieldValue(key, change.after)}
                              </p>
                            ))}
                        </div>
                      ))}
                    </section>
                  ))}
                  <section>
                    <h3 className="text-13 font-medium">{t("web.state_template_retained")}</h3>
                    {preview.retained.map((row) => (
                      <div key={row.id} className="mt-2 text-13">
                        {row.name}
                        {Object.entries(row.changes).map(([key, change]) => (
                          <p key={key} className="text-12 text-secondary">
                            {fieldLabel(key)}: {fieldValue(key, change.before)} → {fieldValue(key, change.after)}
                          </p>
                        ))}
                      </div>
                    ))}
                  </section>
                </div>
              )}
            </DialogBody>
          </DialogMain>
          <DialogActions>
            <Button
              size="md"
              stretch="auto"
              variant="secondary"
              label={t("cancel")}
              disabled={busy}
              onClick={() => setOpen(false)}
            />
            <Button
              size="md"
              stretch="auto"
              variant="secondary"
              label={t("web.state_template_preview")}
              loading={busy}
              onClick={() => void run(false)}
            />
            <Button
              size="md"
              stretch="auto"
              variant="primary"
              label={t("web.state_template_apply")}
              disabled={!preview || stale || busy}
              onClick={() => void run(true)}
            />
          </DialogActions>
        </DialogContent>
      </Dialog>
    </>
  );
}
