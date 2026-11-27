/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import { useContext } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
// components
import { AppLoader } from "@/components/common/app-loader";
import { InstanceNotReady, MaintenanceView } from "@/components/instance";
// hooks
import { useInstance } from "@/hooks/store/use-instance";
import { hydrateAppBootstrap } from "@/lib/bootstrap-cache";
import { StoreContext } from "@/lib/store-context";
import { bootstrapService } from "@/services/bootstrap.service";

type TInstanceWrapper = {
  children: ReactNode;
};

const InstanceWrapper = observer(function InstanceWrapper(props: TInstanceWrapper) {
  const { children } = props;
  // store
  const rootStore = useContext(StoreContext);
  const { isLoading, instance, error, fetchInstanceInfo } = useInstance();

  const { isLoading: isInstanceSWRLoading, error: instanceSWRError } = useSWR(
    "APP_BOOTSTRAP",
    async () => {
      try {
        const data = await bootstrapService.getAppBootstrap();
        if (rootStore) hydrateAppBootstrap(rootStore, data);
        return data;
      } catch {
        // Fallback to legacy individual instance fetch if bootstrap endpoint is unavailable
        await fetchInstanceInfo();
        return null;
      }
    },
    { revalidateOnFocus: false, revalidateIfStale: false }
  );

  // loading state
  if ((isLoading || isInstanceSWRLoading) && !instance)
    return <AppLoader className="relative flex h-screen w-full items-center justify-center" />;

  if (instanceSWRError) return <MaintenanceView />;

  // something went wrong while in the request
  if (error && error?.status === "error") return <>{children}</>;

  // instance is not ready and setup is not done
  if (instance?.is_setup_done === false) return <InstanceNotReady />;

  return <>{children}</>;
});

export default InstanceWrapper;
