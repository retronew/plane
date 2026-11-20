import { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react";
import { Button } from "@makeplane/propel/components/button";
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogHeading,
  DialogMain,
  DialogTitle,
} from "@makeplane/propel/components/dialog";
import { useTranslation } from "@plane/i18n";
import { useUser } from "@/hooks/store/user";
import { watchNotificationOnboarding } from "@/lib/browser-notifications/onboarding";
import { requestBrowserNotificationPermission } from "@/lib/browser-notifications/preference-events";

function NotificationOnboardingDialog({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState(false);
  const onboarding = useRef<ReturnType<typeof watchNotificationOnboarding>>(undefined);

  useEffect(() => {
    const watcher = watchNotificationOnboarding(userId, setOpen);
    onboarding.current = watcher;
    return () => {
      onboarding.current = undefined;
      watcher?.dispose();
    };
  }, [userId]);

  const confirmPresentation = () => onboarding.current?.confirmPresentation();
  const dismiss = () => {
    confirmPresentation();
    setOpen(false);
  };

  const allow = async () => {
    confirmPresentation();
    setRequesting(true);
    setError(false);
    try {
      await requestBrowserNotificationPermission();
      setOpen(false);
    } catch {
      setError(true);
    } finally {
      setRequesting(false);
    }
  };

  // Keep the controlled dialog mounted after dismissal so Propel can finish its exit animation.
  return (
    <Dialog
      open={open}
      disablePointerDismissal
      onOpenChange={(nextOpen) => {
        if (!nextOpen) dismiss();
      }}
      onOpenChangeComplete={(isOpen) => {
        if (isOpen) confirmPresentation();
      }}
    >
      <DialogContent size="sm">
        <DialogMain>
          <DialogHeader>
            <DialogHeading>
              <DialogTitle>{t("notification_preferences.browser.onboarding.title")}</DialogTitle>
              <DialogDescription>{t("notification_preferences.browser.onboarding.description")}</DialogDescription>
            </DialogHeading>
          </DialogHeader>
          {error && (
            <p className="px-4 text-13 text-danger-primary" role="alert">
              {t("notification_preferences.browser.error")}
            </p>
          )}
        </DialogMain>
        <DialogActions>
          <Button
            size="md"
            variant="secondary"
            stretch="auto"
            label={t("notification_preferences.browser.onboarding.later")}
            onClick={dismiss}
          />
          <Button
            size="md"
            variant="primary"
            stretch="auto"
            label={t("notification_preferences.browser.allow")}
            disabled={requesting}
            onClick={() => void allow()}
          />
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}

export const BrowserNotificationOnboarding = observer(function BrowserNotificationOnboarding() {
  const { data: user } = useUser();
  return user?.id ? <NotificationOnboardingDialog key={user.id} userId={user.id} /> : null;
});
