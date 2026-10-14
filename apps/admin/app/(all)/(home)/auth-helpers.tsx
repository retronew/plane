/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Translation } from "@plane/i18n";

import Link from "next/link";
// plane packages
import type { TAdminAuthErrorInfo } from "@plane/constants";
import { SUPPORT_EMAIL, EAdminAuthErrorCodes } from "@plane/constants";

export enum EErrorAlertType {
  BANNER_ALERT = "BANNER_ALERT",
  INLINE_FIRST_NAME = "INLINE_FIRST_NAME",
  INLINE_EMAIL = "INLINE_EMAIL",
  INLINE_PASSWORD = "INLINE_PASSWORD",
  INLINE_EMAIL_CODE = "INLINE_EMAIL_CODE",
}

type TTranslate = (key: string, params?: Record<string, unknown>) => string;

const signInLink = (t: TTranslate, messageKey: string) => (
  <Translation
    translationKey={
      messageKey === "admin.auth_errors.admin_user_already_exist.message"
        ? "web.runtime.auth_admin_existing"
        : "web.runtime.auth_admin_missing"
    }
    components={{
      link: (
        <Link className="font-medium underline underline-offset-4 transition-all hover:font-bold" href="/admin">
          {t("admin.auth_errors.sign_in")}
        </Link>
      ),
    }}
  />
);

const errorCodeMessages: {
  [key in EAdminAuthErrorCodes]: { title: string; message: (t: TTranslate, email?: string) => React.ReactNode };
} = {
  // admin
  [EAdminAuthErrorCodes.ADMIN_ALREADY_EXIST]: {
    title: "admin.auth_errors.admin_already_exist.title",
    message: (t) => t("admin.auth_errors.admin_already_exist.message"),
  },
  [EAdminAuthErrorCodes.REQUIRED_ADMIN_EMAIL_PASSWORD_FIRST_NAME]: {
    title: "admin.auth_errors.required_email_password_first_name.title",
    message: (t) => t("admin.auth_errors.required_email_password_first_name.message"),
  },
  [EAdminAuthErrorCodes.INVALID_ADMIN_EMAIL]: {
    title: "admin.auth_errors.invalid_admin_email.title",
    message: (t) => t("admin.auth_errors.invalid_admin_email.message"),
  },
  [EAdminAuthErrorCodes.INVALID_ADMIN_PASSWORD]: {
    title: "admin.auth_errors.invalid_admin_password.title",
    message: (t) => t("admin.auth_errors.invalid_admin_password.message"),
  },
  [EAdminAuthErrorCodes.REQUIRED_ADMIN_EMAIL_PASSWORD]: {
    title: "admin.auth_errors.required_email_password.title",
    message: (t) => t("admin.auth_errors.required_email_password.message"),
  },
  [EAdminAuthErrorCodes.ADMIN_AUTHENTICATION_FAILED]: {
    title: "admin.auth_errors.authentication_failed.title",
    message: (t) => t("admin.auth_errors.authentication_failed.message"),
  },
  [EAdminAuthErrorCodes.ADMIN_USER_ALREADY_EXIST]: {
    title: "admin.auth_errors.admin_user_already_exist.title",
    message: (t) => signInLink(t, "admin.auth_errors.admin_user_already_exist.message"),
  },
  [EAdminAuthErrorCodes.ADMIN_USER_DOES_NOT_EXIST]: {
    title: "admin.auth_errors.admin_user_does_not_exist.title",
    message: (t) => signInLink(t, "admin.auth_errors.admin_user_does_not_exist.message"),
  },
  [EAdminAuthErrorCodes.ADMIN_USER_DEACTIVATED]: {
    title: "admin.auth_errors.admin_user_deactivated.title",
    message: (t) =>
      t("admin.auth_errors.admin_user_deactivated.message", {
        contact: SUPPORT_EMAIL ? SUPPORT_EMAIL : t("admin.auth_errors.administrator"),
      }),
  },
  [EAdminAuthErrorCodes.ADMIN_SSO_NOT_ADMIN]: {
    title: "admin.auth_errors.sso_not_admin.title",
    message: (t) => t("admin.auth_errors.sso_not_admin.message"),
  },
  [EAdminAuthErrorCodes.ADMIN_SSO_FAILED]: {
    title: "admin.auth_errors.sso_failed.title",
    message: (t) => t("admin.auth_errors.sso_failed.message"),
  },
};

export const authErrorHandler = (
  errorCode: EAdminAuthErrorCodes,
  t: TTranslate,
  email?: string
): TAdminAuthErrorInfo | undefined => {
  const bannerAlertErrorCodes = [
    EAdminAuthErrorCodes.ADMIN_ALREADY_EXIST,
    EAdminAuthErrorCodes.REQUIRED_ADMIN_EMAIL_PASSWORD_FIRST_NAME,
    EAdminAuthErrorCodes.INVALID_ADMIN_EMAIL,
    EAdminAuthErrorCodes.INVALID_ADMIN_PASSWORD,
    EAdminAuthErrorCodes.REQUIRED_ADMIN_EMAIL_PASSWORD,
    EAdminAuthErrorCodes.ADMIN_AUTHENTICATION_FAILED,
    EAdminAuthErrorCodes.ADMIN_USER_ALREADY_EXIST,
    EAdminAuthErrorCodes.ADMIN_USER_DOES_NOT_EXIST,
    EAdminAuthErrorCodes.ADMIN_USER_DEACTIVATED,
    EAdminAuthErrorCodes.ADMIN_SSO_NOT_ADMIN,
    EAdminAuthErrorCodes.ADMIN_SSO_FAILED,
  ];

  if (bannerAlertErrorCodes.includes(errorCode))
    return {
      type: EErrorAlertType.BANNER_ALERT,
      code: errorCode,
      title: errorCodeMessages[errorCode] ? t(errorCodeMessages[errorCode].title) : t("admin.common.error"),
      message: errorCodeMessages[errorCode]?.message(t, email) || t("admin.common.something_went_wrong"),
    };

  return undefined;
};
