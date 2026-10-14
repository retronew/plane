/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// helpers
import { EAuthModes } from "@/types/auth";
import { translate } from "@plane/i18n";

type TAuthHeader = {
  authMode: EAuthModes;
};

type TAuthHeaderContent = {
  header: string;
  subHeader: string;
};

type TAuthHeaderDetails = {
  [mode in EAuthModes]: TAuthHeaderContent;
};

const Titles: TAuthHeaderDetails = {
  [EAuthModes.SIGN_IN]: {
    get header() {
      return translate("web.sign_in_to_upvote_or_comment");
    },
    get subHeader() {
      return translate("web.runtime.public_signin_subtitle");
    },
  },
  [EAuthModes.SIGN_UP]: {
    get header() {
      return translate("web.view_comment_and_do_more");
    },
    get subHeader() {
      return translate("web.runtime.public_signup_subtitle");
    },
  },
};

export function AuthHeader(props: TAuthHeader) {
  const { authMode } = props;

  const getHeaderSubHeader = (mode: EAuthModes | null): TAuthHeaderContent => {
    if (mode) {
      return Titles[mode];
    }

    return {
      header: translate("web.comment_or_react_to_work_items"),
      subHeader: translate("web.runtime.public_auth_subtitle"),
    };
  };

  const { header, subHeader } = getHeaderSubHeader(authMode);

  return (
    <>
      <div className="flex flex-col gap-1">
        <span className="text-20 leading-7 font-semibold text-primary">{header}</span>
        <span className="text-20 leading-7 font-semibold text-placeholder">{subHeader}</span>
      </div>
    </>
  );
}
