/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { STATE_GROUPS } from "@plane/constants";
import { setToast } from "@plane/blocks/toast";
import type { IState, TStateGroups, TStateOperationsCallbacks } from "@plane/types";
// components
import { StateForm } from "@/components/project-states";
import { translate } from "@plane/i18n";

type TStateCreate = {
  groupKey: TStateGroups;
  createStateCallback: TStateOperationsCallbacks["createState"];
  handleClose: () => void;
};

export const StateCreate = observer(function StateCreate(props: TStateCreate) {
  const { groupKey, createStateCallback, handleClose } = props;

  // states
  const [loader, setLoader] = useState(false);

  const onCancel = () => {
    setLoader(false);
    handleClose();
  };

  const onSubmit = async (formData: Partial<IState>) => {
    if (!groupKey) return { status: "error" };

    try {
      await createStateCallback({ ...formData, group: groupKey });

      setToast({
        type: "success",
        title: translate("toast.success"),
        message: translate("web.state_created_successfully"),
      });
      handleClose();
      return { status: "success" };
    } catch (error) {
      const errorStatus = error as { status: number; data: { error: string } };
      if (errorStatus?.status === 400) {
        setToast({
          type: "error",
          title: translate("toast.error"),
          message: translate("web.state_with_that_name_already_exists_please_try_again_with_an"),
        });
        return { status: "already_exists" };
      } else {
        setToast({
          type: "error",
          title: translate("toast.error"),
          message: errorStatus.data.error ?? translate("web.state_could_not_be_created_please_try_again"),
        });
        return { status: "error" };
      }
    }
  };

  return (
    <StateForm
      data={{ name: "", description: "", color: STATE_GROUPS[groupKey].color }}
      stateGroup={groupKey}
      onSubmit={onSubmit}
      onCancel={onCancel}
      buttonDisabled={loader}
      buttonTitle={loader ? translate("web.creating") : translate("web.create")}
    />
  );
});
