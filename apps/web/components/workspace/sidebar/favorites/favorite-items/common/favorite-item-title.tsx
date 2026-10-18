/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { observer } from "mobx-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { cn } from "@plane/utils";
import { useAppTheme } from "@/hooks/store/use-app-theme";
import { usePlatformOS } from "@/hooks/use-platform-os";

type Props = {
  href: string;
  title: string;
  icon: React.ReactNode;
  className?: string;
};

export const FavoriteItemTitle = observer(function FavoriteItemTitle(props: Props) {
  const { href, title, icon, className } = props;
  const pathname = usePathname();
  const isCurrentPage = pathname.replace(/\/$/, "") === href.replace(/\/$/, "");
  // store hooks
  const { toggleSidebar } = useAppTheme();
  const { isMobile } = usePlatformOS();

  const handleOnClick = () => {
    if (isMobile) toggleSidebar();
  };

  return (
    <Tooltip label={title} layout="stacked" side="right" sideOffset={40} disabled={isMobile}>
      <Link
        href={href}
        aria-current={isCurrentPage ? "page" : undefined}
        className={cn("flex w-full items-center gap-2 truncate", className)}
        draggable
        onClick={handleOnClick}
      >
        <span className="flex size-5 items-center justify-center">{icon}</span>
        <span className="flex-1 truncate text-body-sm-medium">{title}</span>
      </Link>
    </Tooltip>
  );
});
