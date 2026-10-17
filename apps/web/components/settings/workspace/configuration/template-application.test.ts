import { describe, expect, it } from "vitest";
import type { TLogoProps, TProjectWorkflow } from "@plane/types";
import type { WorkspaceTemplate } from "@/services/workspace-configuration.service";
import { getPageTemplatePatch, getWorkItemTemplatePatch, isTemplateAvailable } from "./template-application";

const template: WorkspaceTemplate = {
  id: "template",
  kind: "work_item",
  project: null,
  name: "Bug template",
  title: "Bug report",
  short_description: "",
  description_html: "<p>Steps to reproduce</p>",
  priority: "high",
  configuration: {},
};
const workflow: TProjectWorkflow = {
  id: "bug-workflow",
  enabled: true,
  is_active: true,
  can_manage: false,
  initial_state_id: "todo",
  effective_initial_state_id: "todo",
  states: [
    { id: "todo", name: "Todo", color: "#000000", group: "unstarted", allow_creation: true },
    { id: "triage", name: "Triage", color: "#000000", group: "backlog", allow_creation: true },
    { id: "done", name: "Done", color: "#000000", group: "completed", allow_creation: false },
  ],
  transitions: [],
};
const current = { type_id: "task", state_id: "triage" };

describe("template availability shared by picker and page header", () => {
  it("only exposes global and destination project pages", () => {
    const page = { ...template, kind: "page" as const };
    expect(isTemplateAvailable(page, "page", "one")).toBe(true);
    expect(isTemplateAvailable({ ...page, project: "one" }, "page", "one")).toBe(true);
    expect(isTemplateAvailable({ ...page, project: "two" }, "page", "one")).toBe(false);
    expect(isTemplateAvailable({ ...page, project: "two" }, "page")).toBe(false);
    expect(isTemplateAvailable(template, "page", "one")).toBe(false);
  });
});

describe("page template application", () => {
  it("copies the title, HTML and provided logo", () => {
    const logo: TLogoProps = { in_use: "emoji", emoji: { value: "128196" } };
    expect(getPageTemplatePatch({ ...template, configuration: { logo_props: logo } })).toEqual({
      name: template.title,
      description_html: template.description_html,
      logo_props: logo,
    });
  });

  it("preserves a chosen/default logo when old templates omit it", () => {
    const logo: TLogoProps = { in_use: "icon", icon: { name: "File", color: "#123456" } };
    const patch = getPageTemplatePatch(template);
    expect(patch).not.toHaveProperty("logo_props");
    expect({ logo_props: logo, ...patch }.logo_props).toBe(logo);
  });
});

describe("work item template application", () => {
  it("copies the type and forwards complete child fields without stripping them", () => {
    const children = [
      {
        name: "Investigate",
        description_html: "<p>Details</p>",
        type_id: "investigation",
        state_id: "todo",
        priority: "urgent" as const,
        assignee_ids: ["child-member"],
        label_ids: ["child-label"],
      },
    ];
    const patch = getWorkItemTemplatePatch(
      {
        ...template,
        configuration: {
          type_id: "bug",
          state_id: "triage",
          assignee_ids: ["member"],
          label_ids: ["label"],
          module_ids: ["module"],
          children,
        },
      },
      current,
      workflow
    );
    expect(patch).toEqual({
      name: template.title,
      description_html: template.description_html,
      priority: "high",
      type_id: "bug",
      state_id: "triage",
      assignee_ids: ["member"],
      label_ids: ["label"],
      module_ids: ["module"],
      template_children: children,
    });
  });

  it("preserves the current/default type for legacy workspace templates", () => {
    const patch = getWorkItemTemplatePatch(template, current, workflow);
    expect(patch).not.toHaveProperty("type_id");
    expect({ ...current, ...patch }.type_id).toBe("task");
    expect(patch.state_id).toBe("triage");
    expect(patch.template_children).toEqual([]);
  });

  it("applies an explicit untyped template", () => {
    expect(getWorkItemTemplatePatch({ ...template, configuration: { type_id: null } }, current).type_id).toBeNull();
  });

  it.each(["done", "another-workflow-state"])(
    "replaces forbidden template state %s with the creation default",
    (state_id) => {
      expect(
        getWorkItemTemplatePatch({ ...template, configuration: { type_id: "bug", state_id } }, current, workflow)
          .state_id
      ).toBe("todo");
    }
  );

  it("resets a previous type's state when the new template type does not allow it", () => {
    expect(
      getWorkItemTemplatePatch(
        { ...template, configuration: { type_id: "bug" } },
        { ...current, state_id: "other-type-state" },
        workflow
      ).state_id
    ).toBe("todo");
  });

  it("uses the effective initial state for an empty selection and leaves a workflow with no creation state empty", () => {
    expect(getWorkItemTemplatePatch(template, { ...current, state_id: null }, workflow).state_id).toBe("todo");
    expect(
      getWorkItemTemplatePatch({ ...template, configuration: { state_id: "done" } }, current, {
        ...workflow,
        effective_initial_state_id: null,
      }).state_id
    ).toBeNull();
  });

  it("keeps explicit states when workflows are disabled or paused", () => {
    for (const policy of [undefined, { ...workflow, enabled: false }, { ...workflow, is_active: false }]) {
      expect(
        getWorkItemTemplatePatch({ ...template, configuration: { state_id: "done" } }, current, policy).state_id
      ).toBe("done");
    }
  });
});
