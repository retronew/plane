import { useRef, useState } from "react";
import { Button } from "@makeplane/propel/components/button";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogHeading,
  DialogMain,
  DialogTitle,
} from "@makeplane/propel/components/dialog";
import { useTranslation } from "@plane/i18n";
import { UserNotificationPreferences } from "./notification-preferences";

export function UserNotificationPreferencesDialog({
  userId,
  email,
  isOpen,
  onClose,
}: {
  userId: string;
  email: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const close = () => {
    if (!savingRef.current) onClose();
  };
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent size="lg">
        <DialogMain>
          <DialogHeader>
            <DialogHeading>
              <DialogTitle>{t("admin.users.notifications.title")}</DialogTitle>
              <DialogDescription>
                <span className="break-all">{email}</span>
              </DialogDescription>
            </DialogHeading>
          </DialogHeader>
          <DialogBody tabIndex={0}>
            <UserNotificationPreferences
              key={userId}
              userId={userId}
              disabled={false}
              onBusyChange={(busy) => {
                savingRef.current = busy;
                setSaving(busy);
              }}
            />
          </DialogBody>
        </DialogMain>
        <DialogActions>
          <Button
            stretch="auto"
            variant="secondary"
            size="md"
            disabled={saving}
            onClick={close}
            label={t("admin.common.close")}
          />
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}
