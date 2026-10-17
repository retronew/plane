import { useState } from "react";
import useSWR from "swr";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@makeplane/propel/components/button";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { useTranslation } from "@plane/i18n";
import { Select } from "@plane/blocks/select";
import type { TWorkflowStep } from "@plane/types";
import { useProjectWorkflow } from "@/hooks/store/use-project-workflow";

type VersionOption = { id: string; name: string };
export function WorkflowStepsEditor({
  workspaceSlug,
  projectId,
  value,
  onChange,
  approval,
  disabled,
}: {
  workspaceSlug: string;
  projectId: string;
  value: TWorkflowStep[];
  onChange: (steps: TWorkflowStep[]) => void;
  approval: boolean;
  disabled: boolean;
}) {
  const store = useProjectWorkflow(projectId),
    { t } = useTranslation();
  const {
    data: scripts,
    error,
    mutate,
  } = useSWR(["workflow-scripts", workspaceSlug, projectId], () => store.service.scripts(workspaceSlug, projectId));
  const versions: VersionOption[] = (scripts ?? []).flatMap((script) =>
    script.versions.map((version) => ({ id: version.id, name: `${script.name} · v${version.version}` }))
  );
  const [stepKeys] = useState(() => new WeakMap<TWorkflowStep, string>());
  const keyFor = (step: TWorkflowStep) => {
    let key = stepKeys.get(step);
    if (!key) {
      key = crypto.randomUUID();
      stepKeys.set(step, key);
    }
    return key;
  };
  const replaceStep = (index: number, changes: Partial<TWorkflowStep>) => {
    const next = { ...value[index], ...changes };
    stepKeys.set(next, keyFor(value[index]));
    onChange(value.map((item, i) => (i === index ? next : item)));
  };
  const move = (index: number, delta: number) => {
    const next = [...value];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    onChange(next);
  };
  return (
    <section className="space-y-3">
      <h5 className="text-body-xs-medium">{t("web.workflow_runner.steps")}</h5>
      <p className="text-caption-md-regular text-tertiary">{t("web.workflow_runner.steps_hint")}</p>
      {error && (
        <Button stretch="auto" size="sm" variant="ghost" label={t("common.retry")} onClick={() => void mutate()} />
      )}
      {value.map((step, index) => (
        <div key={keyFor(step)} className="space-y-2 rounded-md border border-subtle p-2">
          <Select<VersionOption>
            getValues={() => versions}
            value={versions.find((option) => option.id === step.script_version_id) ?? null}
            onChange={(id) => replaceStep(index, { script_version_id: id })}
            getOptionValue={(option) => option.id}
            getOptionLabel={(option) => option.name}
            disabled={disabled}
            placeholder={t("web.workflow_runner.select_version")}
          >
            <Select.Trigger<VersionOption> variant="select-md">
              {(options) => (
                <span className="truncate">{options[0]?.name ?? t("web.workflow_runner.select_version")}</span>
              )}
            </Select.Trigger>
          </Select>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-caption-md-regular">
              {t("web.workflow_runner.phase")}
              <select
                className="ml-2 rounded border border-subtle bg-layer-1 p-1"
                disabled={disabled}
                value={step.phase}
                onChange={(event) => replaceStep(index, { phase: event.target.value as TWorkflowStep["phase"] })}
              >
                <option value="pre">{t("web.workflow_runner.pre")}</option>
                <option value="post">{t("web.workflow_runner.post")}</option>
              </select>
            </label>
            {approval && (
              <label className="text-caption-md-regular">
                {t("web.workflow_runner.outcome")}
                <select
                  className="ml-2 rounded border border-subtle bg-layer-1 p-1"
                  disabled={disabled}
                  value={step.outcome}
                  onChange={(event) => replaceStep(index, { outcome: event.target.value as TWorkflowStep["outcome"] })}
                >
                  <option value="approve">{t("web.workflow_ui.approve")}</option>
                  <option value="reject">{t("web.workflow_ui.reject")}</option>
                </select>
              </label>
            )}
            <IconButton
              size="sm"
              variant="ghost"
              aria-label={t("web.workflow_runner.move_up")}
              icon={<ArrowUp className="size-3.5" />}
              disabled={disabled || index === 0}
              onClick={() => move(index, -1)}
            />
            <IconButton
              size="sm"
              variant="ghost"
              aria-label={t("web.workflow_runner.move_down")}
              icon={<ArrowDown className="size-3.5" />}
              disabled={disabled || index === value.length - 1}
              onClick={() => move(index, 1)}
            />
            <IconButton
              size="sm"
              variant="ghost"
              aria-label={t("delete")}
              icon={<Trash2 className="size-3.5" />}
              disabled={disabled}
              onClick={() => onChange(value.filter((_, i) => i !== index))}
            />
          </div>
        </div>
      ))}
      <Button
        stretch="auto"
        size="sm"
        variant="ghost"
        icon={<Plus className="size-3.5" />}
        label={t("web.workflow_runner.add_step")}
        disabled={disabled || !versions.length}
        onClick={() =>
          onChange([
            ...value,
            { script_version_id: versions[0].id, phase: "pre", outcome: approval ? "approve" : "transition" },
          ])
        }
      />
      {!versions.length && !error && (
        <p className="text-caption-md-regular text-tertiary">{t("web.workflow_runner.publish_first")}</p>
      )}
    </section>
  );
}
