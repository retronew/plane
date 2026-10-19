/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
// plane imports
import type { IFavorite } from "@plane/types";
// components
import { getPageName } from "@plane/utils";
import {
  FavoriteItemIcon,
  generateFavoriteItemLink,
} from "@/components/workspace/sidebar/favorites/favorite-items/common";
// helpers
// hooks
import { useCycle } from "@/hooks/store/use-cycle";
import { useModule } from "@/hooks/store/use-module";
import { useProject } from "@/hooks/store/use-project";
import { useProjectView } from "@/hooks/store/use-project-view";
// plane web hooks
import { EPageStoreType, usePage } from "@/hooks/store";
import { useAdditionalFavoriteItemDetails } from "@/hooks/use-additional-favorite-item-details";

type PageDetails = ReturnType<typeof usePage>;
type ViewDetails = ReturnType<ReturnType<typeof useProjectView>["getViewById"]>;
type CycleDetails = ReturnType<ReturnType<typeof useCycle>["getCycleById"]>;
type ModuleDetails = ReturnType<ReturnType<typeof useModule>["getModuleById"]>;
type ProjectDetails = ReturnType<ReturnType<typeof useProject>["getProjectById"]>;
type FavoriteLogoProps = IFavorite["entity_data"]["logo_props"];
type FavoriteDetails = { itemTitle: string | undefined; itemIcon: ReactNode };

function getProjectFavoriteDetails(
  project: ProjectDetails,
  name: string | undefined,
  logo: FavoriteLogoProps
): FavoriteDetails {
  return {
    itemTitle: project?.name ?? name,
    itemIcon: <FavoriteItemIcon type="project" logo={project?.logo_props || logo} />,
  };
}

function getPageFavoriteDetails(page: PageDetails, name: string | undefined, logo: FavoriteLogoProps): FavoriteDetails {
  return {
    itemTitle: getPageName(page?.name ?? name),
    itemIcon: <FavoriteItemIcon type="page" logo={page?.logo_props ?? logo} />,
  };
}

function getViewFavoriteDetails(view: ViewDetails, name: string | undefined, logo: FavoriteLogoProps): FavoriteDetails {
  return {
    itemTitle: view?.name ?? name,
    itemIcon: <FavoriteItemIcon type="view" logo={view?.logo_props || logo} />,
  };
}

function getCycleFavoriteDetails(cycle: CycleDetails, name: string | undefined): FavoriteDetails {
  return {
    itemTitle: cycle?.name ?? name,
    itemIcon: <FavoriteItemIcon type="cycle" />,
  };
}

function getModuleFavoriteDetails(module: ModuleDetails, name: string | undefined): FavoriteDetails {
  return {
    itemTitle: module?.name ?? name,
    itemIcon: <FavoriteItemIcon type="module" />,
  };
}

function getFavoriteDetails(args: {
  entityType: string;
  favoriteItemName: string | undefined;
  favoriteItemLogoProps: FavoriteLogoProps;
  project: ProjectDetails;
  page: PageDetails;
  view: ViewDetails;
  cycle: CycleDetails;
  module: ModuleDetails;
  getAdditional: (workspaceSlug: string, favorite: IFavorite) => FavoriteDetails;
  workspaceSlug: string;
  favorite: IFavorite;
}): FavoriteDetails {
  switch (args.entityType) {
    case "project":
      return getProjectFavoriteDetails(args.project, args.favoriteItemName, args.favoriteItemLogoProps);
    case "page":
      return getPageFavoriteDetails(args.page, args.favoriteItemName, args.favoriteItemLogoProps);
    case "view":
      return getViewFavoriteDetails(args.view, args.favoriteItemName, args.favoriteItemLogoProps);
    case "cycle":
      return getCycleFavoriteDetails(args.cycle, args.favoriteItemName);
    case "module":
      return getModuleFavoriteDetails(args.module, args.favoriteItemName);
    default:
      return args.getAdditional(args.workspaceSlug, args.favorite);
  }
}

export const useFavoriteItemDetails = (workspaceSlug: string, favorite: IFavorite) => {
  const {
    entity_identifier: favoriteItemId,
    entity_data: { logo_props: favoriteItemLogoProps },
    entity_type: favoriteItemEntityType,
  } = favorite;
  const favoriteItemName = favorite.entity_data?.name || favorite.name;
  const itemId = favoriteItemId ?? "";
  // store hooks
  const { getViewById } = useProjectView();
  const { getProjectById } = useProject();
  const { getCycleById } = useCycle();
  const { getModuleById } = useModule();
  // additional details
  const { getAdditionalFavoriteItemDetails } = useAdditionalFavoriteItemDetails();
  // derived values
  const pageDetail = usePage({
    pageId: itemId,
    storeType: EPageStoreType.PROJECT,
  });
  const details = getFavoriteDetails({
    entityType: favoriteItemEntityType,
    favoriteItemName,
    favoriteItemLogoProps,
    project: getProjectById(favorite.project_id ?? ""),
    page: pageDetail,
    view: getViewById(itemId),
    cycle: getCycleById(itemId),
    module: getModuleById(itemId),
    getAdditional: getAdditionalFavoriteItemDetails,
    workspaceSlug,
    favorite,
  });

  return {
    itemIcon: details.itemIcon,
    itemTitle: details.itemTitle,
    itemLink: generateFavoriteItemLink(workspaceSlug.toString(), favorite),
  };
};
