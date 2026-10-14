/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { intersection } from "lodash-es";
import { observer } from "mobx-react";
import { Controller, useForm } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogMain,
  DialogHeader,
  DialogHeading,
  DialogTitle,
  DialogBody,
} from "@makeplane/propel/components/dialog";
import { SettingsHeading } from "@/components/settings/heading";
import {
  EUserPermissions,
  EUserPermissionsLevel,
  EXPORTERS_LIST,
  ISSUE_DISPLAY_FILTERS_BY_PAGE,
} from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Download } from "lucide-react";
import { Icon } from "@makeplane/propel/components/icon";
import { Button } from "@makeplane/propel/components/button";
import { setToast } from "@plane/blocks/toast";

import { EIssuesStoreType } from "@plane/types";
import type { TWorkItemFilterExpression } from "@plane/types";
import { Select, SelectContent, SelectItem, SelectList, SelectTrigger } from "@makeplane/propel/components/select";
import { WorkspaceLevelWorkItemFiltersHOC } from "@/components/work-item-filters/filters-hoc/workspace-level";
import { WorkItemFiltersRow } from "@/components/work-item-filters/filters-row";
// components
import { ProjectSelect } from "@/components/dropdowns/project/project-select";
// hooks
import { useProject } from "@/hooks/store/use-project";
import { useUser, useUserPermissions } from "@/hooks/store/user";
import { ProjectExportService } from "@/services/project/project-export.service";
// local imports
import { SettingsBoxedControlItem } from "../settings/boxed-control-item";

type Props = {
  workspaceSlug: string;
  provider: string | null;
  mutateServices: () => void;
};
type FormData = {
  provider: (typeof EXPORTERS_LIST)[0];
  project: string[];
  multiple: boolean;
  filters: TWorkItemFilterExpression;
};

const initialWorkItemFilters = {
  richFilters: {},
  displayFilters: {},
  displayProperties: {},
  kanbanFilters: {
    group_by: [],
    sub_group_by: [],
  },
};

const projectExportService = new ProjectExportService();

export const ExportForm = observer(function ExportForm(props: Props) {
  // props
  const { workspaceSlug, mutateServices } = props;
  // states
  const [open, setOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  // store hooks
  const { allowPermissions } = useUserPermissions();
  const { data: user, canPerformAnyCreateAction, projectsWithCreatePermissions } = useUser();
  const { workspaceProjectIds, getProjectById } = useProject();
  const { t } = useTranslation();
  // form
  const { handleSubmit, control } = useForm<FormData>({
    defaultValues: {
      provider: EXPORTERS_LIST[0],
      project: [],
      multiple: false,
      filters: {},
    },
  });

  // derived values
  const hasProjects = workspaceProjectIds && workspaceProjectIds.length > 0;
  const isMember = allowPermissions([EUserPermissions.ADMIN, EUserPermissions.MEMBER], EUserPermissionsLevel.WORKSPACE);
  const wsProjectIdsWithCreatePermisisons = projectsWithCreatePermissions
    ? intersection(workspaceProjectIds, Object.keys(projectsWithCreatePermissions))
    : [];
  const wsProjectIdsWithCreatePermissionsSet = new Set(wsProjectIdsWithCreatePermisisons);
  const exporterOptions = EXPORTERS_LIST.map((service) => ({
    label: t(service.i18n_title),
    value: service.provider,
  }));

  // handlers
  async function ExportCSVToMail(formData: FormData) {
    setExportLoading(true);
    if (workspaceSlug && user) {
      const payload = {
        provider: formData.provider.provider,
        project: formData.project,
        multiple: formData.project.length > 1,
        rich_filters: formData.filters,
      };
      try {
        await projectExportService.csvExport(workspaceSlug, payload);
        mutateServices();
        setOpen(false);
        setExportLoading(false);
        setToast({
          type: "success",
          title: t("workspace_settings.settings.exports.modal.toasts.success.title"),
          message: t("workspace_settings.settings.exports.modal.toasts.success.message", {
            entity:
              formData.provider.provider === "csv"
                ? "CSV"
                : formData.provider.provider === "xlsx"
                  ? "Excel"
                  : formData.provider.provider === "json"
                    ? "JSON"
                    : "",
          }),
        });
      } catch (_error) {
        setExportLoading(false);
        setToast({
          type: "error",
          title: t("error"),
          message: t("workspace_settings.settings.exports.modal.toasts.error.message"),
        });
      }
    } else {
      setExportLoading(false);
    }
  }

  return (
    <>
      <SettingsHeading
        title={t("workspace_settings.settings.exports.heading")}
        description={t("workspace_settings.settings.exports.description")}
        control={
          <Button variant="primary" size="md" stretch="auto" label={t("export")} onClick={() => setOpen(true)} />
        }
      />
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!exportLoading) setOpen(value);
        }}
      >
        <DialogContent size="lg">
          <DialogMain>
            <DialogHeader>
              <DialogHeading>
                <DialogTitle>{t("export")}</DialogTitle>
              </DialogHeading>
            </DialogHeader>
            <DialogBody>
              <form
                onSubmit={(e) => {
                  void handleSubmit(ExportCSVToMail)(e);
                }}
                className="flex flex-col gap-5"
              >
                <div className="space-y-5">
                  {/* Project Selector */}
                  <SettingsBoxedControlItem
                    className="border-0 bg-transparent p-0"
                    title={t("web.projects")}
                    control={
                      <div className="w-56 max-w-full">
                        <Controller
                          control={control}
                          name="project"
                          disabled={!isMember || !hasProjects || !canPerformAnyCreateAction}
                          render={({ field: { value, onChange, disabled } }) => (
                            <ProjectSelect
                              multiple
                              projectList="all"
                              value={value ?? []}
                              onChange={onChange}
                              variant="select-md"
                              disabled={disabled}
                              filterOption={(projectId) => wsProjectIdsWithCreatePermissionsSet.has(projectId)}
                              // Preserve selected ids even if their project is unloaded or removed from the available options.
                              resolveProject={(projectId) => {
                                const project = getProjectById(projectId);
                                if (!project) return { id: projectId, name: projectId };
                                return {
                                  id: project.id,
                                  name: project.name,
                                  identifier: project.identifier,
                                  logo_props: project.logo_props,
                                };
                              }}
                              placeholder={t("web.all_projects")}
                              className="w-full"
                            />
                          )}
                        />
                      </div>
                    }
                  />
                  {/* Format Selector */}
                  <SettingsBoxedControlItem
                    className="border-0 bg-transparent p-0"
                    title={t("workspace_settings.settings.exports.format")}
                    control={
                      <Controller
                        control={control}
                        name="provider"
                        disabled={!isMember || !hasProjects || !canPerformAnyCreateAction}
                        render={({ field: { value, onChange, disabled } }) => (
                          <div className="w-56 max-w-full [&_button]:w-full [&_button]:min-w-0">
                            <Select<string>
                              items={exporterOptions}
                              value={value.provider}
                              onValueChange={(provider) => {
                                const service = EXPORTERS_LIST.find((item) => item.provider === provider);
                                if (service) onChange(service);
                              }}
                              disabled={disabled}
                            >
                              <SelectTrigger size="md" placeholder={t("workspace_settings.settings.exports.format")} />
                              <SelectContent side="bottom" align="end">
                                <SelectList>
                                  {exporterOptions.map((option) => (
                                    <SelectItem
                                      key={option.value}
                                      value={option.value}
                                      size="md"
                                      label={option.label}
                                    />
                                  ))}
                                </SelectList>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      />
                    }
                  />
                </div>
                {/* Rich Filters */}
                <div className="w-full">
                  <Controller
                    control={control}
                    name="filters"
                    render={({ field: { onChange, value } }) => (
                      <WorkspaceLevelWorkItemFiltersHOC
                        entityId={workspaceSlug}
                        entityType={EIssuesStoreType.GLOBAL}
                        filtersToShowByLayout={ISSUE_DISPLAY_FILTERS_BY_PAGE.my_issues.filters}
                        initialWorkItemFilters={{ ...initialWorkItemFilters, richFilters: value }}
                        isTemporary
                        updateFilters={(updatedFilters) => onChange(updatedFilters)}
                        showOnMount
                        workspaceSlug={workspaceSlug}
                      >
                        {({ filter: workspaceExportWorkItemsFilter }) =>
                          workspaceExportWorkItemsFilter && (
                            <WorkItemFiltersRow filter={workspaceExportWorkItemsFilter} variant="modal" />
                          )
                        }
                      </WorkspaceLevelWorkItemFiltersHOC>
                    )}
                  />
                </div>
                <div className="flex justify-end gap-2 border-t border-subtle pt-4">
                  <Button
                    variant="secondary"
                    size="md"
                    stretch="auto"
                    label={t("cancel")}
                    disabled={exportLoading}
                    onClick={() => setOpen(false)}
                  />
                  <Button
                    variant="primary"
                    size="md"
                    stretch="auto"
                    type="submit"
                    disabled={exportLoading || !isMember || !hasProjects}
                    loading={exportLoading}
                    icon={<Icon icon={Download} />}
                    iconPosition="start"
                    label={
                      exportLoading
                        ? t("workspace_settings.settings.exports.submitting")
                        : t("workspace_settings.settings.exports.start_export")
                    }
                  />
                </div>
              </form>
            </DialogBody>
          </DialogMain>
        </DialogContent>
      </Dialog>
    </>
  );
});
