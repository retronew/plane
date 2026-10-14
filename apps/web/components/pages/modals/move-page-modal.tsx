/** Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only */
import { useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { ArrowRightLeft } from "lucide-react";
import { Button } from "@makeplane/propel/components/button";
import { Icon } from "@makeplane/propel/components/icon";
import {
  Dialog,
  DialogContent,
  DialogMain,
  DialogHeader,
  DialogHeading,
  DialogTitle,
  DialogBody,
  DialogActions,
} from "@makeplane/propel/components/dialog";
import { convertBinaryDataToBase64String } from "@plane/editor";
import { useTranslation } from "@plane/i18n";
import { setToast } from "@plane/blocks/toast";
import { ProjectSelect } from "@/components/dropdowns/project/project-select";
import { useUserPermissions } from "@/hooks/store/user";
import { usePageStore } from "@/hooks/store";
import type { EPageStoreType } from "@/hooks/store";
import { useAppRouter } from "@/hooks/use-app-router";
import { ProjectPageService } from "@/services/page";
import type { TPageInstance } from "@/store/pages/base-page";

const service = new ProjectPageService();
type Props = { isOpen: boolean; onClose: () => void; page: TPageInstance; storeType: EPageStoreType };

export const MovePageModal = observer(function MovePageModal({ isOpen, onClose, page, storeType }: Props) {
  const [destination, setDestination] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState("");
  const { workspaceSlug } = useParams();
  const slug = workspaceSlug?.toString() ?? "";
  const source = page.project_ids?.[0];
  const { movePage } = usePageStore(storeType);
  const { getProjectRoleByWorkspaceSlugAndProjectId } = useUserPermissions();
  const router = useAppRouter();
  const { t } = useTranslation();
  const close = () => {
    if (moving) return;
    setDestination(null);
    setError("");
    onClose();
  };
  const move = async () => {
    if (!destination || !source || !slug || !page.id || moving) return;
    setMoving(true);
    setError("");
    try {
      const editor = page.editor.editorRef;
      if (editor) {
        // Merge the persisted document before flushing the latest local edits.
        const latest = await service.fetchDescriptionBinary(slug, source, page.id);
        if (latest?.byteLength) editor.setProviderDocument(new Uint8Array(latest));
        const { binary, html, json } = editor.getDocument();
        if (!binary || !json) throw new Error("Editor is not ready to move.");
        await page.updateDescription({
          description_binary: convertBinaryDataToBase64String(binary),
          description_html: html,
          description_json: json,
        });
        await service.update(slug, source, page.id, { name: page.name });
      }
      await movePage(slug, source, page.id, destination);
      onClose();
      router.push(`/${slug}/projects/${destination}/pages/${page.id}/`);
      setToast({ type: "success", title: t("toast.success"), message: t("web.page_move_success") });
    } catch {
      setError(t("web.page_move_failed"));
    } finally {
      setMoving(false);
    }
  };
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent size="sm">
        <DialogMain>
          <DialogHeader>
            <DialogHeading>
              <DialogTitle>{t("web.move_page")}</DialogTitle>
            </DialogHeading>
          </DialogHeader>
          <DialogBody>
            <p className="mb-4 text-13 text-secondary">{t("web.page_move_description")}</p>
            <ProjectSelect
              variant="select-md"
              value={destination}
              onChange={setDestination}
              excludeProjectId={source}
              disabled={moving}
              filterOption={(id) => (getProjectRoleByWorkspaceSlugAndProjectId(slug, id) ?? 0) >= 15}
              placeholder={t("web.page_move_destination")}
              className="w-full"
            />
            {error && (
              <p role="alert" className="mt-3 text-13 text-danger-primary">
                {error}
              </p>
            )}
          </DialogBody>
        </DialogMain>
        <DialogActions>
          <Button variant="secondary" size="md" stretch="auto" label={t("cancel")} disabled={moving} onClick={close} />
          <Button
            variant="primary"
            size="md"
            stretch="auto"
            icon={<Icon icon={ArrowRightLeft} />}
            label={t(moving ? "web.page_moving" : "web.move_page")}
            loading={moving}
            disabled={!destination || destination === source || moving}
            onClick={() => void move()}
          />
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
});
