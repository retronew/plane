/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { FullScreenOutline } from "@makeplane/propel/icons";
// plane imports
import { Tooltip } from "@makeplane/propel/components/tooltip";
// local imports
import { ImageFullScreenModal } from "./modal";
import { translate } from "@plane/i18n";

type Props = {
  image: {
    aspectRatio: number;
    downloadSrc: string;
    height: string;
    src: string;
    width: string;
  };
  isTouchDevice: boolean;
  isFullScreenEnabled: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ImageFullScreenActionRoot(props: Props) {
  const { image, isTouchDevice, isFullScreenEnabled, onOpenChange } = props;
  // derived values
  const { downloadSrc, src, width, aspectRatio } = image;

  return (
    <>
      <ImageFullScreenModal
        aspectRatio={aspectRatio}
        downloadSrc={downloadSrc}
        isFullScreenEnabled={isFullScreenEnabled}
        isTouchDevice={isTouchDevice}
        src={src}
        width={width}
        toggleFullScreenMode={onOpenChange}
      />
      <Tooltip label={translate("web.view_in_full_screen")} disabled={isTouchDevice}>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onOpenChange(true);
          }}
          className="grid h-full flex-shrink-0 place-items-center text-on-color/60 transition-colors hover:text-on-color"
          aria-label={translate("web.view_image_in_full_screen")}
        >
          <FullScreenOutline className="size-3" />
        </button>
      </Tooltip>
    </>
  );
}
