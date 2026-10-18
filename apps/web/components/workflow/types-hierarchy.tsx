import { Fragment, useState } from "react";
import { Link } from "react-router";
import { ArrowDownOutline, MoreHorizontalOutline } from "@makeplane/propel/icons";
import { Button } from "@makeplane/propel/components/button";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Menu, MenuItem, MenuTrigger } from "@makeplane/propel/components/menu";
import { ActionMenuContent } from "@plane/blocks/common";
import { useTranslation } from "@plane/i18n";
import type { THierarchyRequest, TProjectIssueHierarchy } from "@plane/types";
import type { ProjectWorkflowService } from "@/services/project/workflow.service";
import { TypesLogo } from "./types-logo";
import { HierarchyImpactDialog } from "./hierarchy-impact-dialog";

const key = "web.issue_hierarchy";
export function TypesHierarchy({
  config,
  base,
  service,
  workspaceSlug,
  projectId,
  canManage,
  onApplied,
}: {
  config: TProjectIssueHierarchy;
  base: string;
  service: ProjectWorkflowService;
  workspaceSlug: string;
  projectId: string;
  canManage: boolean;
  onApplied: (config: TProjectIssueHierarchy) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<THierarchyRequest | null>(null);
  const [extraLevels, setExtraLevels] = useState<number[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewRequest, setPreviewRequest] = useState<THierarchyRequest | null>(null);
  const current: THierarchyRequest = draft ?? {
    enabled: config.enabled,
    default_level: config.default_level,
    policy_version: config.policy_version,
    type_levels: config.issue_types.map((type) => ({ type_id: type.id, level: type.level ?? 0 })),
  };
  // Sorting a freshly allocated array supports the current web TypeScript target.
  // eslint-disable-next-line unicorn/no-array-sort
  const levels = [...new Set([0, ...current.type_levels.map((type) => type.level), ...extraLevels])].sort(
    (a, b) => a - b
  );
  // ES2023 Array.toReversed is outside the web TypeScript target.
  // eslint-disable-next-line unicorn/no-array-reverse
  const descendingLevels = [...levels].reverse();
  const update = (changes: Partial<THierarchyRequest>) => setDraft({ ...current, ...changes });
  const removeLevel = (level: number) => {
    const remaining = levels.filter((value) => value !== level);
    const remap = (value: number) => Math.max(0, remaining.indexOf(value));
    setExtraLevels(remaining.map((_, index) => index));
    update({
      default_level: remap(current.default_level),
      type_levels: current.type_levels.map((type) => ({ ...type, level: remap(type.level) })),
    });
  };
  const manageable = canManage && config.can_manage;
  return (
    <div className="flex w-full max-w-[900px] flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h4 className="text-h6-medium text-primary">{t("web.workflow_ui.types_settings.hierarchy")}</h4>
          <p className="mt-1 text-body-xs-regular text-secondary">{t(`${key}.scope`)}</p>
          <p className="mt-1 text-body-xs-regular text-secondary">
            {t(current.enabled ? `${key}.rules` : `${key}.disabled_hint`)}
          </p>
        </div>
        {!config.enabled && manageable && (
          <Button
            size="sm"
            variant="secondary"
            stretch="auto"
            label={t(current.enabled ? `${key}.cancel_enable` : `${key}.enable`)}
            onClick={() => update({ enabled: !current.enabled })}
          />
        )}
      </div>
      <div className="rounded-lg bg-surface-2 p-4">
        {/* A copied array keeps the ascending levels used by move menus intact. */}
        {/* eslint-disable-next-line unicorn/no-array-sort */}
        {descendingLevels.map((level, index) => {
          const items = config.issue_types.filter(
            (type) => current.type_levels.find((entry) => entry.type_id === type.id)?.level === level
          );
          return (
            <Fragment key={level}>
              {index > 0 && (
                <div aria-hidden="true" className="h-8 py-1 pl-4 text-tertiary">
                  <ArrowDownOutline className="size-6" />
                </div>
              )}
              <section
                className="flex flex-wrap items-center gap-3 rounded-lg border border-subtle bg-layer-2 p-3"
                aria-label={t(`${key}.level_label`, { level })}
              >
                <h5 className="grid size-8 shrink-0 place-items-center rounded-md bg-layer-3 text-caption-md-medium text-secondary">
                  {level}
                </h5>
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                  {items.map((type) => (
                    <div
                      key={type.id}
                      className="inline-flex max-w-full items-center rounded-md bg-layer-3 px-1.5 text-body-xs-medium text-secondary"
                    >
                      <Link
                        to={`${base}types/${type.id}/properties/`}
                        className="inline-flex min-h-7 min-w-0 items-center gap-1"
                      >
                        <TypesLogo type={type} size={12} backgroundSize={16} />
                        <span className="truncate">{type.name}</span>
                      </Link>
                      {manageable && (
                        <Menu>
                          <MenuTrigger
                            render={
                              <IconButton
                                size="sm"
                                variant="ghost"
                                icon={<MoreHorizontalOutline />}
                                aria-label={t(`${key}.move_type`, { name: type.name })}
                              />
                            }
                          />
                          <ActionMenuContent side="bottom" align="end">
                            {levels.map((target) => (
                              <MenuItem
                                key={target}
                                label={t(`${key}.move_to`, { level: target })}
                                disabled={target === level}
                                onClick={() =>
                                  update({
                                    type_levels: current.type_levels.map((entry) =>
                                      entry.type_id === type.id ? { ...entry, level: target } : entry
                                    ),
                                  })
                                }
                              />
                            ))}
                          </ActionMenuContent>
                        </Menu>
                      )}
                    </div>
                  ))}
                  {!items.length && <p className="text-body-xs-regular text-tertiary">{t(`${key}.empty_level`)}</p>}
                </div>
                {manageable ? (
                  <Menu>
                    <MenuTrigger
                      render={
                        <IconButton
                          size="sm"
                          variant="ghost"
                          icon={<MoreHorizontalOutline />}
                          aria-label={t(`${key}.level_actions`, { level })}
                        />
                      }
                    />
                    <ActionMenuContent side="bottom" align="end">
                      <MenuItem
                        label={t(`${key}.set_default`)}
                        disabled={current.default_level === level}
                        onClick={() => update({ default_level: level })}
                      />
                      <MenuItem
                        label={t(`${key}.remove_level`)}
                        disabled={items.length > 0 || level === 0}
                        onClick={() => removeLevel(level)}
                      />
                    </ActionMenuContent>
                  </Menu>
                ) : null}
                {current.default_level === level && (
                  <span className="text-caption-md-regular text-secondary">{t(`${key}.default_level`)}</span>
                )}
              </section>
            </Fragment>
          );
        })}
      </div>
      <p className="text-body-xs-regular text-secondary">{t(`${key}.default_hint`)}</p>
      {manageable && (
        <>
          <p className="text-body-xs-regular text-secondary">{t(`${key}.normalize_hint`)}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              stretch="auto"
              label={t(`${key}.add_level`)}
              onClick={() => {
                setExtraLevels([...extraLevels, Math.max(...levels) + 1]);
                setDraft(current);
              }}
            />
            <div className="ml-auto flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                stretch="auto"
                disabled={!draft}
                label={t(`${key}.discard`)}
                onClick={() => {
                  setDraft(null);
                  setExtraLevels([]);
                }}
              />
              <Button
                size="sm"
                variant="primary"
                stretch="auto"
                disabled={
                  !draft || extraLevels.some((level) => !current.type_levels.some((type) => type.level === level))
                }
                label={t("save")}
                onClick={() => {
                  setPreviewRequest(current);
                  setPreviewOpen(true);
                }}
              />
            </div>
          </div>
        </>
      )}
      {previewRequest && (
        <HierarchyImpactDialog
          open={previewOpen}
          request={previewRequest}
          service={service}
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          onClose={() => setPreviewOpen(false)}
          onClosed={() => setPreviewRequest(null)}
          onApplied={async (result) => {
            setDraft(null);
            setExtraLevels([]);
            setPreviewOpen(false);
            await onApplied(result);
          }}
        />
      )}
    </div>
  );
}
