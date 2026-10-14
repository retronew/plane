/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { EAuthModes } from "@plane/constants";
import { translate, Translation } from "@plane/i18n";

interface TermsAndConditionsProps {
  authType?: EAuthModes;
}

export function TermsAndConditions({ authType = EAuthModes.SIGN_IN }: TermsAndConditionsProps) {
  return (
    <div>
      <p className="text-13 text-tertiary">
        <Translation
          translationKey="web.runtime.terms_agreement"
          values={{ mode: authType === EAuthModes.SIGN_UP ? "signup" : "signin" }}
          components={{
            terms: (
              <a
                href="https://plane.so/legals/terms-and-conditions"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                {translate("web.terms_of_service")}
              </a>
            ),
            privacy: (
              <a
                href="https://plane.so/legals/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                {translate("web.privacy_policy")}
              </a>
            ),
          }}
        />
      </p>
    </div>
  );
}
