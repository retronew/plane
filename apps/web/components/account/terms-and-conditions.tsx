/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import Link from "next/link";
import { EAuthModes } from "@plane/constants";
import { translate } from "@plane/i18n";

interface TermsAndConditionsProps {
  authType?: EAuthModes;
}

// Constants for better maintainability
const LEGAL_LINKS = {
  termsOfService: "https://plane.so/legals/terms-and-conditions",
  privacyPolicy: "https://plane.so/legals/privacy-policy",
} as const;

const MESSAGES = {
  [EAuthModes.SIGN_UP]: "web.terms_by_creating_account",
  [EAuthModes.SIGN_IN]: "web.terms_by_signing_in",
} as const;

// Reusable link component to reduce duplication
function LegalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-secondary" target="_blank" rel="noopener noreferrer">
      <span className="text-13 font-medium whitespace-nowrap underline hover:cursor-pointer">{children}</span>
    </Link>
  );
}

export function TermsAndConditions({ authType = EAuthModes.SIGN_IN }: TermsAndConditionsProps) {
  return (
    <div>
      <p className="text-13 text-tertiary">
        {translate(MESSAGES[authType])}
        <LegalLink href={LEGAL_LINKS.termsOfService}>{translate("web.terms_of_service")}</LegalLink>{" "}
        {translate("web.and")} <LegalLink href={LEGAL_LINKS.privacyPolicy}>{translate("web.privacy_policy")}</LegalLink>
        {translate("web.terms_end")}
      </p>
    </div>
  );
}
