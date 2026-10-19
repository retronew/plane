import { translate } from "@plane/i18n";

export function exportStatusLabel(status: string) {
  switch (status) {
    case "completed":
    case "processing":
    case "failed":
    case "expired":
    case "queued":
      return translate(`workspace_settings.settings.exports.status_labels.${status}`);
    default:
      return status;
  }
}
