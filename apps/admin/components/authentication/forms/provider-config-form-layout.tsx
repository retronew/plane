import type { MouseEvent, ReactNode } from "react";
// plane imports
import { Button } from "@makeplane/propel/components/button";
import {
  DialogActions,
  DialogBody,
  DialogHeader,
  DialogHeading,
  DialogMain,
  DialogTitle,
} from "@makeplane/propel/components/dialog";
import { useTranslation } from "@plane/i18n";
// components
import type { TCopyField } from "@/components/common/copy-field";
import { PlaneDetailsPanel } from "./plane-details-panel";

type Props = {
  /** Provider name, e.g. "Gitea": fills in the dialog title and both column headings. */
  provider: string;
  /** The provider's own fields, rendered in the left column. */
  children: ReactNode;
  /** The values Plane hands to the provider, rendered in the right column. */
  serviceFields: TCopyField[];
  isDirty: boolean;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: (event: MouseEvent<HTMLButtonElement>) => void;
};

/**
 * Dialog shell shared by every OAuth provider config form: heading, the two-column body and the
 * cancel/save actions.
 */
export function ProviderConfigFormLayout({
  provider,
  children,
  serviceFields,
  isDirty,
  isSubmitting,
  onCancel,
  onSubmit,
}: Props) {
  const { t } = useTranslation();

  return (
    <>
      <DialogMain>
        <DialogHeader>
          <DialogHeading>
            <DialogTitle>{t("admin.authentication.configure_provider", { provider })}</DialogTitle>
          </DialogHeading>
        </DialogHeader>
        <DialogBody>
          <div className="grid w-full grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
            <div className="flex flex-col gap-y-4">
              <div className="text-14 font-medium">
                {t("admin.authentication.oauth.provider_details_for_plane", { provider })}
              </div>
              {children}
            </div>
            <PlaneDetailsPanel
              title={t("admin.authentication.oauth.plane_details_for_provider", { provider })}
              fields={serviceFields}
            />
          </div>
        </DialogBody>
      </DialogMain>
      <DialogActions>
        <Button variant="secondary" size="md" stretch="auto" onClick={onCancel} label={t("admin.common.cancel")} />
        <Button
          variant="primary"
          size="md"
          stretch="auto"
          onClick={onSubmit}
          loading={isSubmitting}
          disabled={!isDirty}
          label={isSubmitting ? t("admin.common.saving") : t("admin.common.save_changes")}
        />
      </DialogActions>
    </>
  );
}
