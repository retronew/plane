/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */
import { translate, Translation } from "@plane/i18n";

type Props = {
  isSignUp?: boolean;
};

export function TermsAndConditions(props: Props) {
  const { isSignUp = false } = props;
  return (
    <span className="flex items-center justify-center py-6">
      <p className="text-center text-13 whitespace-pre-line text-secondary">
        <Translation
          translationKey="web.runtime.terms_agreement"
          values={{ mode: isSignUp ? "signup" : "signin" }}
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
    </span>
  );
}
