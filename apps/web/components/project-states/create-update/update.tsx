/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { setToast } from "@plane/blocks/toast";
import type { IState, TStateOperationsCallbacks } from "@plane/types";
// components
import { StateForm } from "@/components/project-states";
import { useProjectState } from "@/hooks/store/use-project-state";
import { translate } from "@plane/i18n";

type TStateUpdate = {
  state: IState;
  updateStateCallback: TStateOperationsCallbacks["updateState"];
  handleClose: () => void;
};

export const StateUpdate = observer(function StateUpdate(props: TStateUpdate) {
  const { state, updateStateCallback, handleClose } = props;
  const { getStatePercentageInGroup } = useProjectState();
  const percentage = getStatePercentageInGroup(state.id);
  // states
  const [loader, setLoader] = useState(false);

  const onCancel = () => {
    setLoader(false);
    handleClose();
  };

  const onSubmit = async (formData: Partial<IState>) => {
    if (!state.id) return { status: "error" };

    try {
      await updateStateCallback(state.id, formData);
      setToast({
        type: "success",
        title: translate("toast.success"),
        message: translate("web.state_updated_successfully"),
      });
      handleClose();
      return { status: "success" };
    } catch (error) {
      const errorStatus = error as { status: number };
      if (errorStatus?.status === 400) {
        setToast({
          type: "error",
          title: translate("toast.error"),
          message: translate("web.another_state_exists_with_the_same_name_please_try_again_wit"),
        });
        return { status: "already_exists" };
      } else {
        setToast({
          type: "error",
          title: translate("toast.error"),
          message: translate("web.state_could_not_be_updated_please_try_again"),
        });
        return { status: "error" };
      }
    }
  };

  return (
    <StateForm
      data={state}
      percentage={percentage ? percentage / 100 : undefined}
      onSubmit={onSubmit}
      onCancel={onCancel}
      buttonDisabled={loader}
      buttonTitle={loader ? translate("web.updating_2") : translate("web.update")}
    />
  );
});
