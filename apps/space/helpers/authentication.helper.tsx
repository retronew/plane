/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Link } from "react-router";
// helpers
import { SUPPORT_EMAIL } from "@plane/constants";
import { translate, Translation } from "@plane/i18n";

export enum EPageTypes {
  INIT = "INIT",
  PUBLIC = "PUBLIC",
  NON_AUTHENTICATED = "NON_AUTHENTICATED",
  ONBOARDING = "ONBOARDING",
  AUTHENTICATED = "AUTHENTICATED",
}

export enum EErrorAlertType {
  BANNER_ALERT = "BANNER_ALERT",
  TOAST_ALERT = "TOAST_ALERT",
  INLINE_FIRST_NAME = "INLINE_FIRST_NAME",
  INLINE_EMAIL = "INLINE_EMAIL",
  INLINE_PASSWORD = "INLINE_PASSWORD",
  INLINE_EMAIL_CODE = "INLINE_EMAIL_CODE",
}

export enum EAuthenticationErrorCodes {
  // Global
  INSTANCE_NOT_CONFIGURED = "5000",
  INVALID_EMAIL = "5005",
  EMAIL_REQUIRED = "5010",
  SIGNUP_DISABLED = "5015",
  // Password strength
  INVALID_PASSWORD = "5020",
  SMTP_NOT_CONFIGURED = "5025",
  // Sign Up
  USER_ALREADY_EXIST = "5030",
  AUTHENTICATION_FAILED_SIGN_UP = "5035",
  REQUIRED_EMAIL_PASSWORD_SIGN_UP = "5040",
  INVALID_EMAIL_SIGN_UP = "5045",
  INVALID_EMAIL_MAGIC_SIGN_UP = "5050",
  MAGIC_SIGN_UP_EMAIL_CODE_REQUIRED = "5055",
  // Sign In
  BOT_USER_LOGIN_FORBIDDEN = "5017",
  USER_ACCOUNT_DEACTIVATED = "5019",
  USER_DOES_NOT_EXIST = "5060",
  AUTHENTICATION_FAILED_SIGN_IN = "5065",
  REQUIRED_EMAIL_PASSWORD_SIGN_IN = "5070",
  INVALID_EMAIL_SIGN_IN = "5075",
  INVALID_EMAIL_MAGIC_SIGN_IN = "5080",
  MAGIC_SIGN_IN_EMAIL_CODE_REQUIRED = "5085",
  // Both Sign in and Sign up for magic
  INVALID_MAGIC_CODE_SIGN_IN = "5090",
  INVALID_MAGIC_CODE_SIGN_UP = "5092",
  EXPIRED_MAGIC_CODE_SIGN_IN = "5095",
  EXPIRED_MAGIC_CODE_SIGN_UP = "5097",
  EMAIL_CODE_ATTEMPT_EXHAUSTED_SIGN_IN = "5100",
  EMAIL_CODE_ATTEMPT_EXHAUSTED_SIGN_UP = "5102",
  // Oauth
  OAUTH_NOT_CONFIGURED = "5104",
  GOOGLE_NOT_CONFIGURED = "5105",
  GITHUB_NOT_CONFIGURED = "5110",
  GITLAB_NOT_CONFIGURED = "5111",
  OIDC_NOT_CONFIGURED = "5113",
  GOOGLE_OAUTH_PROVIDER_ERROR = "5115",
  GITHUB_OAUTH_PROVIDER_ERROR = "5120",
  GITLAB_OAUTH_PROVIDER_ERROR = "5121",
  OAUTH_PROVIDER_UNVERIFIED_EMAIL = "5124",
  OIDC_OAUTH_PROVIDER_ERROR = "5126",
  OIDC_EMAIL_NOT_PROVIDED = "5127",
  OIDC_EMAIL_BIND_EXPIRED = "5128",
  OIDC_EMAIL_BIND_INVALID_CODE = "5129",
  OIDC_ACCOUNT_ALREADY_LINKED = "5131",
  // Reset Password
  INVALID_PASSWORD_TOKEN = "5125",
  EXPIRED_PASSWORD_TOKEN = "5130",
  // Change password
  INCORRECT_OLD_PASSWORD = "5135",
  MISSING_PASSWORD = "5138",
  INVALID_NEW_PASSWORD = "5140",
  // set password
  PASSWORD_ALREADY_SET = "5145",
  // Admin
  ADMIN_ALREADY_EXIST = "5150",
  REQUIRED_ADMIN_EMAIL_PASSWORD_FIRST_NAME = "5155",
  INVALID_ADMIN_EMAIL = "5160",
  INVALID_ADMIN_PASSWORD = "5165",
  REQUIRED_ADMIN_EMAIL_PASSWORD = "5170",
  ADMIN_AUTHENTICATION_FAILED = "5175",
  ADMIN_USER_ALREADY_EXIST = "5180",
  ADMIN_USER_DOES_NOT_EXIST = "5185",
}

export type TAuthErrorInfo = {
  type: EErrorAlertType;
  code: EAuthenticationErrorCodes;
  title: string;
  message: React.ReactNode;
};

const errorCodeMessages: {
  [key in EAuthenticationErrorCodes]: { title: string; message: (email?: string) => React.ReactNode };
} = {
  // global
  [EAuthenticationErrorCodes.INSTANCE_NOT_CONFIGURED]: {
    get title() {
      return translate("web.instance_not_configured");
    },
    message: () => translate("web.auth_errors.instance_not_configured_please_contact_your_administrator"),
  },
  [EAuthenticationErrorCodes.SIGNUP_DISABLED]: {
    get title() {
      return translate("web.sign_up_disabled");
    },
    message: () => translate("web.auth_errors.sign_up_disabled_please_contact_your_administrator"),
  },
  [EAuthenticationErrorCodes.INVALID_PASSWORD]: {
    get title() {
      return translate("web.invalid_password");
    },
    message: () => translate("web.auth_errors.invalid_password_please_try_again"),
  },
  [EAuthenticationErrorCodes.SMTP_NOT_CONFIGURED]: {
    get title() {
      return translate("web.smtp_not_configured");
    },
    message: () => translate("web.auth_errors.smtp_not_configured_please_contact_your_administrator"),
  },

  // email check in both sign up and sign in
  [EAuthenticationErrorCodes.INVALID_EMAIL]: {
    get title() {
      return translate("web.invalid_email");
    },
    message: () => translate("web.auth_errors.invalid_email_please_try_again"),
  },
  [EAuthenticationErrorCodes.EMAIL_REQUIRED]: {
    get title() {
      return translate("web.email_required");
    },
    message: () => translate("web.auth_errors.email_required_please_try_again"),
  },

  // sign up
  [EAuthenticationErrorCodes.USER_ALREADY_EXIST]: {
    get title() {
      return translate("web.user_already_exists");
    },
    message: (email = undefined) => (
      <Translation
        translationKey="web.runtime.auth_existing"
        components={{
          link: (
            <Link
              className="font-medium underline underline-offset-4 transition-all hover:font-bold"
              to={`/sign-in${email ? `?email=${encodeURIComponent(email)}` : ``}`}
            >
              {translate("web.sign_in_2")}
            </Link>
          ),
        }}
      />
    ),
  },
  [EAuthenticationErrorCodes.REQUIRED_EMAIL_PASSWORD_SIGN_UP]: {
    get title() {
      return translate("web.email_and_password_required");
    },
    message: () => translate("web.auth_errors.email_and_password_required_please_try_again"),
  },
  [EAuthenticationErrorCodes.AUTHENTICATION_FAILED_SIGN_UP]: {
    get title() {
      return translate("web.authentication_failed");
    },
    message: () => translate("web.auth_errors.authentication_failed_please_try_again"),
  },
  [EAuthenticationErrorCodes.INVALID_EMAIL_SIGN_UP]: {
    get title() {
      return translate("web.invalid_email");
    },
    message: () => translate("web.auth_errors.invalid_email_please_try_again"),
  },
  [EAuthenticationErrorCodes.MAGIC_SIGN_UP_EMAIL_CODE_REQUIRED]: {
    get title() {
      return translate("web.email_and_code_required");
    },
    message: () => translate("web.auth_errors.email_and_code_required_please_try_again"),
  },
  [EAuthenticationErrorCodes.INVALID_EMAIL_MAGIC_SIGN_UP]: {
    get title() {
      return translate("web.invalid_email");
    },
    message: () => translate("web.auth_errors.invalid_email_please_try_again"),
  },

  // sign in
  [EAuthenticationErrorCodes.BOT_USER_LOGIN_FORBIDDEN]: {
    get title() {
      return translate("web.sign_in_not_allowed");
    },
    message: () => translate("web.auth_errors.this_account_cannot_be_used_to_sign_in_please_use_a_personal_account"),
  },
  [EAuthenticationErrorCodes.USER_ACCOUNT_DEACTIVATED]: {
    get title() {
      return translate("web.user_account_deactivated");
    },
    message: () =>
      translate("web.auth_errors.user_account_deactivated_contact", {
        contact: SUPPORT_EMAIL || translate("web.auth_errors.administrator"),
      }),
  },

  [EAuthenticationErrorCodes.USER_DOES_NOT_EXIST]: {
    get title() {
      return translate("web.user_does_not_exist");
    },
    message: (email = undefined) => (
      <Translation
        translationKey="web.runtime.auth_missing"
        components={{
          link: (
            <Link
              className="font-medium underline underline-offset-4 transition-all hover:font-bold"
              to={`/${email ? `?email=${encodeURIComponent(email)}` : ``}`}
            >
              {translate("web.create_one")}
            </Link>
          ),
        }}
      />
    ),
  },
  [EAuthenticationErrorCodes.REQUIRED_EMAIL_PASSWORD_SIGN_IN]: {
    get title() {
      return translate("web.email_and_password_required");
    },
    message: () => translate("web.auth_errors.email_and_password_required_please_try_again"),
  },
  [EAuthenticationErrorCodes.AUTHENTICATION_FAILED_SIGN_IN]: {
    get title() {
      return translate("web.authentication_failed");
    },
    message: () => translate("web.auth_errors.authentication_failed_please_try_again"),
  },
  [EAuthenticationErrorCodes.INVALID_EMAIL_SIGN_IN]: {
    get title() {
      return translate("web.invalid_email");
    },
    message: () => translate("web.auth_errors.invalid_email_please_try_again"),
  },
  [EAuthenticationErrorCodes.MAGIC_SIGN_IN_EMAIL_CODE_REQUIRED]: {
    get title() {
      return translate("web.email_and_code_required");
    },
    message: () => translate("web.auth_errors.email_and_code_required_please_try_again"),
  },
  [EAuthenticationErrorCodes.INVALID_EMAIL_MAGIC_SIGN_IN]: {
    get title() {
      return translate("web.invalid_email");
    },
    message: () => translate("web.auth_errors.invalid_email_please_try_again"),
  },

  // Both Sign in and Sign up
  [EAuthenticationErrorCodes.INVALID_MAGIC_CODE_SIGN_IN]: {
    get title() {
      return translate("web.authentication_failed");
    },
    message: () => translate("web.auth_errors.invalid_magic_code_please_try_again"),
  },
  [EAuthenticationErrorCodes.INVALID_MAGIC_CODE_SIGN_UP]: {
    get title() {
      return translate("web.authentication_failed");
    },
    message: () => translate("web.auth_errors.invalid_magic_code_please_try_again"),
  },
  [EAuthenticationErrorCodes.EXPIRED_MAGIC_CODE_SIGN_IN]: {
    get title() {
      return translate("web.expired_magic_code");
    },
    message: () => translate("web.auth_errors.expired_magic_code_please_try_again"),
  },
  [EAuthenticationErrorCodes.EXPIRED_MAGIC_CODE_SIGN_UP]: {
    get title() {
      return translate("web.expired_magic_code");
    },
    message: () => translate("web.auth_errors.expired_magic_code_please_try_again"),
  },
  [EAuthenticationErrorCodes.EMAIL_CODE_ATTEMPT_EXHAUSTED_SIGN_IN]: {
    get title() {
      return translate("web.expired_magic_code");
    },
    message: () => translate("web.auth_errors.expired_magic_code_please_try_again"),
  },
  [EAuthenticationErrorCodes.EMAIL_CODE_ATTEMPT_EXHAUSTED_SIGN_UP]: {
    get title() {
      return translate("web.expired_magic_code");
    },
    message: () => translate("web.auth_errors.expired_magic_code_please_try_again"),
  },

  // Oauth
  [EAuthenticationErrorCodes.OAUTH_NOT_CONFIGURED]: {
    get title() {
      return translate("web.oauth_not_configured");
    },
    message: () => translate("web.auth_errors.oauth_not_configured_please_contact_your_administrator"),
  },
  [EAuthenticationErrorCodes.GOOGLE_NOT_CONFIGURED]: {
    get title() {
      return translate("web.google_not_configured");
    },
    message: () => translate("web.auth_errors.google_not_configured_please_contact_your_administrator"),
  },
  [EAuthenticationErrorCodes.GITHUB_NOT_CONFIGURED]: {
    get title() {
      return translate("web.github_not_configured");
    },
    message: () => translate("web.auth_errors.github_not_configured_please_contact_your_administrator"),
  },
  [EAuthenticationErrorCodes.GITLAB_NOT_CONFIGURED]: {
    get title() {
      return translate("web.gitlab_not_configured");
    },
    message: () => translate("web.auth_errors.gitlab_not_configured_please_contact_your_administrator"),
  },
  [EAuthenticationErrorCodes.GOOGLE_OAUTH_PROVIDER_ERROR]: {
    get title() {
      return translate("web.google_oauth_provider_error");
    },
    message: () => translate("web.auth_errors.google_oauth_provider_error_please_try_again"),
  },
  [EAuthenticationErrorCodes.GITHUB_OAUTH_PROVIDER_ERROR]: {
    get title() {
      return translate("web.github_oauth_provider_error");
    },
    message: () => translate("web.auth_errors.github_oauth_provider_error_please_try_again"),
  },
  [EAuthenticationErrorCodes.GITLAB_OAUTH_PROVIDER_ERROR]: {
    get title() {
      return translate("web.gitlab_oauth_provider_error");
    },
    message: () => translate("web.auth_errors.gitlab_oauth_provider_error_please_try_again"),
  },
  [EAuthenticationErrorCodes.OIDC_NOT_CONFIGURED]: {
    get title() {
      return translate("web.auth_errors.oidc_not_configured");
    },
    message: () => translate("web.auth_errors.oidc_is_not_configured_please_contact_your_administrator"),
  },
  [EAuthenticationErrorCodes.OIDC_OAUTH_PROVIDER_ERROR]: {
    get title() {
      return translate("web.auth_errors.oidc_provider_error");
    },
    message: () => translate("web.auth_errors.oidc_provider_error_please_try_again"),
  },
  [EAuthenticationErrorCodes.OIDC_EMAIL_NOT_PROVIDED]: {
    get title() {
      return translate("web.auth_errors.email_not_provided");
    },
    message: () =>
      translate(
        "web.auth_errors.your_identity_provider_did_not_return_an_email_address_and_email_verification_is_unavailable_because_smtp_is_not_configured_please_ask_your_administrator_to_add_your_email_in_the_identity_provider_or_configure_smtp"
      ),
  },
  [EAuthenticationErrorCodes.OIDC_EMAIL_BIND_EXPIRED]: {
    get title() {
      return translate("web.auth_errors.email_binding_expired");
    },
    message: () => translate("web.auth_errors.your_email_binding_session_has_expired_please_sign_in_again"),
  },
  [EAuthenticationErrorCodes.OIDC_EMAIL_BIND_INVALID_CODE]: {
    get title() {
      return translate("web.auth_errors.invalid_verification_code");
    },
    message: () =>
      translate("web.auth_errors.the_verification_code_is_incorrect_please_check_your_email_and_try_again"),
  },
  [EAuthenticationErrorCodes.OIDC_ACCOUNT_ALREADY_LINKED]: {
    get title() {
      return translate("web.auth_errors.account_already_linked");
    },
    message: () => translate("web.auth_errors.this_single_sign_on_account_is_already_linked_to_another_plane_account"),
  },
  [EAuthenticationErrorCodes.OAUTH_PROVIDER_UNVERIFIED_EMAIL]: {
    get title() {
      return translate("web.auth_errors.unverified_email");
    },
    message: () =>
      translate(
        "web.auth_errors.your_identity_provider_did_not_return_a_verified_email_please_contact_your_administrator"
      ),
  },

  // Reset Password
  [EAuthenticationErrorCodes.INVALID_PASSWORD_TOKEN]: {
    get title() {
      return translate("web.invalid_password_token");
    },
    message: () => translate("web.auth_errors.invalid_password_token"),
  },
  [EAuthenticationErrorCodes.EXPIRED_PASSWORD_TOKEN]: {
    get title() {
      return translate("web.expired_password_token");
    },
    message: () => translate("web.auth_errors.expired_password_token_please_try_again"),
  },

  // Change password
  [EAuthenticationErrorCodes.MISSING_PASSWORD]: {
    get title() {
      return translate("web.password_required");
    },
    message: () => translate("web.auth_errors.password_required_please_try_again"),
  },
  [EAuthenticationErrorCodes.INCORRECT_OLD_PASSWORD]: {
    get title() {
      return translate("web.incorrect_old_password");
    },
    message: () => translate("web.auth_errors.incorrect_old_password_please_try_again"),
  },
  [EAuthenticationErrorCodes.INVALID_NEW_PASSWORD]: {
    get title() {
      return translate("web.invalid_new_password");
    },
    message: () => translate("web.auth_errors.invalid_new_password_please_try_again"),
  },

  // set password
  [EAuthenticationErrorCodes.PASSWORD_ALREADY_SET]: {
    get title() {
      return translate("web.password_already_set");
    },
    message: () => translate("web.auth_errors.password_already_set_please_try_again"),
  },

  // admin
  [EAuthenticationErrorCodes.ADMIN_ALREADY_EXIST]: {
    get title() {
      return translate("web.admin_already_exists");
    },
    message: () => translate("web.auth_errors.admin_already_exists_please_try_again"),
  },
  [EAuthenticationErrorCodes.REQUIRED_ADMIN_EMAIL_PASSWORD_FIRST_NAME]: {
    get title() {
      return translate("web.email_password_and_first_name_required");
    },
    message: () => translate("web.auth_errors.email_password_and_first_name_required_please_try_again"),
  },
  [EAuthenticationErrorCodes.INVALID_ADMIN_EMAIL]: {
    get title() {
      return translate("web.invalid_admin_email");
    },
    message: () => translate("web.auth_errors.invalid_admin_email_please_try_again"),
  },
  [EAuthenticationErrorCodes.INVALID_ADMIN_PASSWORD]: {
    get title() {
      return translate("web.invalid_admin_password");
    },
    message: () => translate("web.auth_errors.invalid_admin_password_please_try_again"),
  },
  [EAuthenticationErrorCodes.REQUIRED_ADMIN_EMAIL_PASSWORD]: {
    get title() {
      return translate("web.email_and_password_required");
    },
    message: () => translate("web.auth_errors.email_and_password_required_please_try_again"),
  },
  [EAuthenticationErrorCodes.ADMIN_AUTHENTICATION_FAILED]: {
    get title() {
      return translate("web.authentication_failed");
    },
    message: () => translate("web.auth_errors.authentication_failed_please_try_again"),
  },
  [EAuthenticationErrorCodes.ADMIN_USER_ALREADY_EXIST]: {
    get title() {
      return translate("web.admin_user_already_exists_2");
    },
    message: () => (
      <Translation
        translationKey="web.runtime.auth_admin_existing"
        components={{
          link: (
            <Link className="font-medium underline underline-offset-4 transition-all hover:font-bold" to={`/admin`}>
              {translate("web.sign_in_2")}
            </Link>
          ),
        }}
      />
    ),
  },
  [EAuthenticationErrorCodes.ADMIN_USER_DOES_NOT_EXIST]: {
    get title() {
      return translate("web.admin_user_does_not_exist_2");
    },
    message: () => (
      <Translation
        translationKey="web.runtime.auth_admin_missing"
        components={{
          link: (
            <Link className="font-medium underline underline-offset-4 transition-all hover:font-bold" to={`/admin`}>
              {translate("web.sign_in_2")}
            </Link>
          ),
        }}
      />
    ),
  },
};

export const authErrorHandler = (errorCode: EAuthenticationErrorCodes, email?: string): TAuthErrorInfo | undefined => {
  const bannerAlertErrorCodes = [
    EAuthenticationErrorCodes.INSTANCE_NOT_CONFIGURED,
    EAuthenticationErrorCodes.INVALID_EMAIL,
    EAuthenticationErrorCodes.EMAIL_REQUIRED,
    EAuthenticationErrorCodes.SIGNUP_DISABLED,
    EAuthenticationErrorCodes.INVALID_PASSWORD,
    EAuthenticationErrorCodes.SMTP_NOT_CONFIGURED,
    EAuthenticationErrorCodes.USER_ALREADY_EXIST,
    EAuthenticationErrorCodes.AUTHENTICATION_FAILED_SIGN_UP,
    EAuthenticationErrorCodes.REQUIRED_EMAIL_PASSWORD_SIGN_UP,
    EAuthenticationErrorCodes.INVALID_EMAIL_SIGN_UP,
    EAuthenticationErrorCodes.INVALID_EMAIL_MAGIC_SIGN_UP,
    EAuthenticationErrorCodes.MAGIC_SIGN_UP_EMAIL_CODE_REQUIRED,
    EAuthenticationErrorCodes.USER_DOES_NOT_EXIST,
    EAuthenticationErrorCodes.AUTHENTICATION_FAILED_SIGN_IN,
    EAuthenticationErrorCodes.REQUIRED_EMAIL_PASSWORD_SIGN_IN,
    EAuthenticationErrorCodes.INVALID_EMAIL_SIGN_IN,
    EAuthenticationErrorCodes.INVALID_EMAIL_MAGIC_SIGN_IN,
    EAuthenticationErrorCodes.MAGIC_SIGN_IN_EMAIL_CODE_REQUIRED,
    EAuthenticationErrorCodes.INVALID_MAGIC_CODE_SIGN_IN,
    EAuthenticationErrorCodes.INVALID_MAGIC_CODE_SIGN_UP,
    EAuthenticationErrorCodes.EXPIRED_MAGIC_CODE_SIGN_IN,
    EAuthenticationErrorCodes.EXPIRED_MAGIC_CODE_SIGN_UP,
    EAuthenticationErrorCodes.EMAIL_CODE_ATTEMPT_EXHAUSTED_SIGN_IN,
    EAuthenticationErrorCodes.EMAIL_CODE_ATTEMPT_EXHAUSTED_SIGN_UP,
    EAuthenticationErrorCodes.OAUTH_NOT_CONFIGURED,
    EAuthenticationErrorCodes.GOOGLE_NOT_CONFIGURED,
    EAuthenticationErrorCodes.GITHUB_NOT_CONFIGURED,
    EAuthenticationErrorCodes.GITLAB_NOT_CONFIGURED,
    EAuthenticationErrorCodes.GOOGLE_OAUTH_PROVIDER_ERROR,
    EAuthenticationErrorCodes.GITHUB_OAUTH_PROVIDER_ERROR,
    EAuthenticationErrorCodes.GITLAB_OAUTH_PROVIDER_ERROR,
    EAuthenticationErrorCodes.OIDC_NOT_CONFIGURED,
    EAuthenticationErrorCodes.OIDC_OAUTH_PROVIDER_ERROR,
    EAuthenticationErrorCodes.OIDC_EMAIL_NOT_PROVIDED,
    EAuthenticationErrorCodes.OIDC_EMAIL_BIND_EXPIRED,
    EAuthenticationErrorCodes.OIDC_EMAIL_BIND_INVALID_CODE,
    EAuthenticationErrorCodes.OIDC_ACCOUNT_ALREADY_LINKED,
    EAuthenticationErrorCodes.OAUTH_PROVIDER_UNVERIFIED_EMAIL,
    EAuthenticationErrorCodes.INVALID_PASSWORD_TOKEN,
    EAuthenticationErrorCodes.EXPIRED_PASSWORD_TOKEN,
    EAuthenticationErrorCodes.INCORRECT_OLD_PASSWORD,
    EAuthenticationErrorCodes.MISSING_PASSWORD,
    EAuthenticationErrorCodes.INVALID_NEW_PASSWORD,
    EAuthenticationErrorCodes.PASSWORD_ALREADY_SET,
    EAuthenticationErrorCodes.ADMIN_ALREADY_EXIST,
    EAuthenticationErrorCodes.REQUIRED_ADMIN_EMAIL_PASSWORD_FIRST_NAME,
    EAuthenticationErrorCodes.INVALID_ADMIN_EMAIL,
    EAuthenticationErrorCodes.INVALID_ADMIN_PASSWORD,
    EAuthenticationErrorCodes.REQUIRED_ADMIN_EMAIL_PASSWORD,
    EAuthenticationErrorCodes.ADMIN_AUTHENTICATION_FAILED,
    EAuthenticationErrorCodes.ADMIN_USER_ALREADY_EXIST,
    EAuthenticationErrorCodes.ADMIN_USER_DOES_NOT_EXIST,
    EAuthenticationErrorCodes.BOT_USER_LOGIN_FORBIDDEN,
    EAuthenticationErrorCodes.USER_ACCOUNT_DEACTIVATED,
  ];

  if (bannerAlertErrorCodes.includes(errorCode))
    return {
      type: EErrorAlertType.BANNER_ALERT,
      code: errorCode,
      title: errorCodeMessages[errorCode]?.title || translate("web.error"),
      message: errorCodeMessages[errorCode]?.message(email) || translate("web.something_went_wrong_please_try_again"),
    };

  return undefined;
};
