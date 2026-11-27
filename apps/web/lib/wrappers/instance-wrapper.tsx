/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import { useEffect } from "react";
import { observer } from "mobx-react";
import useSWR, { preload } from "swr";
// components
import { AppLoader } from "@/components/common/app-loader";
import { InstanceNotReady, MaintenanceView } from "@/components/instance";
// hooks
import { useInstance } from "@/hooks/store/use-instance";
import { useUser } from "@/hooks/store/user";

type TInstanceWrapper = {
  children: ReactNode;
};

const InstanceWrapper = observer(function InstanceWrapper(props: TInstanceWrapper) {
  const { children } = props;
  // store
  const { isLoading, instance, error, fetchInstanceInfo } = useInstance();
  const { data: currentUser, fetchCurrentUser } = useUser();

  const { isLoading: isInstanceSWRLoading, error: instanceSWRError } = useSWR(
    "INSTANCE_INFORMATION",
    async () => await fetchInstanceInfo(),
    { revalidateOnFocus: false }
  );

  // Kick off user bootstrap in parallel with /api/instances/ so auth wrappers don't wait serially.
  useEffect(() => {
    if (!currentUser) {
      void preload("USER_INFORMATION", () => fetchCurrentUser().catch(() => undefined));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
