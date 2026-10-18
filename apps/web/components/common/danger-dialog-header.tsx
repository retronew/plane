import { DialogHeader, DialogHeading, DialogTitle } from "@makeplane/propel/components/dialog";
import { WarningTriangleOutline } from "@makeplane/propel/icons";

/** Header of a destructive confirmation dialog: warning badge plus the action title. */
export function DangerDialogHeader({ title }: { title: string }) {
  return (
    <DialogHeader>
      <div className="flex w-full items-center justify-start gap-6">
        <span className="place-items-center rounded-full bg-danger-subtle p-4">
          <WarningTriangleOutline className="h-6 w-6 text-danger-primary" aria-hidden="true" />
        </span>
        <DialogHeading>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeading>
      </div>
    </DialogHeader>
  );
}
