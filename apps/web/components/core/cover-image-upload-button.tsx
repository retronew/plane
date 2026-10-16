import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useParams } from "next/navigation";
import { Button } from "@makeplane/propel/components/button";
import { ACCEPTED_COVER_IMAGE_MIME_TYPES_FOR_REACT_DROPZONE, MAX_FILE_SIZE } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { setToast } from "@plane/blocks/toast";
import { EFileAssetType } from "@plane/types";
import { FileService } from "@/services/file.service";

const fileService = new FileService();
const acceptedTypes = Object.keys(ACCEPTED_COVER_IMAGE_MIME_TYPES_FOR_REACT_DROPZONE);

type Props = {
  label: string;
  onChange: (url: string) => void;
  onUploadingChange?: (uploading: boolean) => void;
  disabled?: boolean;
  tabIndex?: number;
  isProfileCover?: boolean;
  projectId?: string | null;
};

/** Select a local image and upload it; the surrounding form owns saving the cover association. */
export function CoverImageUploadButton({
  label,
  onChange,
  onUploadingChange,
  disabled = false,
  tabIndex,
  isProfileCover = false,
  projectId,
}: Props) {
  const { workspaceSlug } = useParams();
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  const uploading = useRef(false);
  const [isUploading, setIsUploading] = useState(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || uploading.current) return;
    if (!acceptedTypes.includes(file.type) || file.size > MAX_FILE_SIZE) {
      setToast({
        type: "error",
        title: t("web.image_not_uploaded"),
        message: t(
          file.size > MAX_FILE_SIZE
            ? "web.the_image_size_cannot_exceed_5_mb"
            : "web.please_upload_a_file_in_a_valid_format"
        ),
      });
      return;
    }
    if (!isProfileCover && !workspaceSlug) return;
    uploading.current = true;
    setIsUploading(true);
    onUploadingChange?.(true);
    try {
      const result = isProfileCover
        ? await fileService.uploadUserAsset({ entity_identifier: "", entity_type: EFileAssetType.USER_COVER }, file)
        : await fileService.uploadWorkspaceAsset(
            workspaceSlug!.toString(),
            { entity_identifier: projectId ?? "", entity_type: EFileAssetType.PROJECT_COVER },
            file
          );
      if (mounted.current) onChange(result.asset_url);
    } catch {
      if (mounted.current)
        setToast({
          type: "error",
          title: t("web.image_not_uploaded"),
          message: t("web.the_image_could_not_be_uploaded"),
        });
    } finally {
      uploading.current = false;
      if (mounted.current) {
        setIsUploading(false);
        onUploadingChange?.(false);
      }
    }
  };
  return (
    <span className="inline-flex shrink-0 [--control-radius-xs:6px]">
      <input
        ref={inputRef}
        type="file"
        hidden
        accept={acceptedTypes.join(",")}
        disabled={disabled || isUploading}
        onChange={(event) => void upload(event)}
      />
      <Button
        data-cover-upload-button=""
        type="button"
        size="xs"
        variant="secondary"
        stretch="auto"
        label={isUploading ? t("web.uploading_2") : label}
        loading={isUploading}
        disabled={disabled || isUploading}
        tabIndex={tabIndex}
        onClick={() => inputRef.current?.click()}
      />
    </span>
  );
}
