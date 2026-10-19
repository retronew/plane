import type { IWebhook } from "@plane/types";
import { translate } from "@plane/i18n";

export const INDIVIDUAL_WEBHOOK_OPTIONS: {
  key: keyof IWebhook;
  label: string;
  description: string;
}[] = [
  {
    key: "project",
    get label() {
      return translate("web.projects");
    },
    get description() {
      return translate("web.project_created_updated_or_deleted");
    },
  },
  {
    key: "cycle",
    get label() {
      return translate("web.cycles");
    },
    get description() {
      return translate("web.cycle_created_updated_or_deleted");
    },
  },
  {
    key: "issue",
    get label() {
      return translate("web.work_items_af8f");
    },
    get description() {
      return translate("web.work_item_created_updated_deleted_added_to_a_cycle_or_module");
    },
  },
  {
    key: "module",
    get label() {
      return translate("web.title_modules");
    },
    get description() {
      return translate("web.module_created_updated_or_deleted");
    },
  },
  {
    key: "issue_comment",
    get label() {
      return translate("web.work_item_comments");
    },
    get description() {
      return translate("web.comment_posted_updated_or_deleted");
    },
  },
];
