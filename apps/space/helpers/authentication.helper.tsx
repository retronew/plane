/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Link } from "react-router";
// helpers
import { SUPPORT_EMAIL } from "@plane/constants";
import { translate } from "@plane/i18n";

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
    message: () => `Instance not configured. Please contact your administrator.`,
  },
  [EAuthenticationErrorCodes.SIGNUP_DISABLED]: {
    get title() {
      return translate("web.sign_up_disabled");
    },
    message: () => `Sign up disabled. Please contact your administrator.`,
  },
  [EAuthenticationErrorCodes.INVALID_PASSWORD]: {
    get title() {
      return translate("web.invalid_password");
    },
    message: () => `Invalid password. Please try again.`,
  },
  [EAuthenticationErrorCodes.SMTP_NOT_CONFIGURED]: {
    get title() {
      return translate("web.smtp_not_configured");
    },
    message: () => `SMTP not configured. Please contact your administrator.`,
  },

  // email check in both sign up and sign in
  [EAuthenticationErrorCodes.INVALID_EMAIL]: {
    get title() {
      return translate("web.invalid_email");
    },
    message: () => `Invalid email. Please try again.`,
  },
  [EAuthenticationErrorCodes.EMAIL_REQUIRED]: {
    get title() {
      return translate("web.email_required");
    },
    message: () => `Email required. Please try again.`,
  },

  // sign up
  [EAuthenticationErrorCodes.USER_ALREADY_EXIST]: {
    get title() {
      return translate("web.user_already_exists");
    },
    message: (email = undefined) => (
      <div>
        {translate("web.your_account_is_already_registered")}
        <Link
          className="font-medium underline underline-offset-4 transition-all hover:font-bold"
          to={`/sign-in${email ? `?email=${encodeURIComponent(email)}` : ``}`}
        >
          {translate("web.sign_in_2")}
        </Link>
        &nbsp;now.
      </div>
    ),
  },
  [EAuthenticationErrorCodes.REQUIRED_EMAIL_PASSWORD_SIGN_UP]: {
    get title() {
      return translate("web.email_and_password_required");
    },
    message: () => `Email and password required. Please try again.`,
  },
  [EAuthenticationErrorCodes.AUTHENTICATION_FAILED_SIGN_UP]: {
    get title() {
      return translate("web.authentication_failed");
    },
    message: () => `Authentication failed. Please try again.`,
  },
  [EAuthenticationErrorCodes.INVALID_EMAIL_SIGN_UP]: {
    get title() {
      return translate("web.invalid_email");
    },
    message: () => `Invalid email. Please try again.`,
  },
  [EAuthenticationErrorCodes.MAGIC_SIGN_UP_EMAIL_CODE_REQUIRED]: {
    get title() {
      return translate("web.email_and_code_required");
    },
    message: () => `Email and code required. Please try again.`,
  },
  [EAuthenticationErrorCodes.INVALID_EMAIL_MAGIC_SIGN_UP]: {
    get title() {
      return translate("web.invalid_email");
    },
    message: () => `Invalid email. Please try again.`,
  },

  // sign in
  [EAuthenticationErrorCodes.BOT_USER_LOGIN_FORBIDDEN]: {
    get title() {
      return translate("web.sign_in_not_allowed");
    },
    message: () => `This account cannot be used to sign in. Please use a personal account.`,
  },
  [EAuthenticationErrorCodes.USER_ACCOUNT_DEACTIVATED]: {
    get title() {
      return translate("web.user_account_deactivated");
    },
    message: () => `User account deactivated. Please contact ${SUPPORT_EMAIL ? SUPPORT_EMAIL : "administrator"}.`,
  },

  [EAuthenticationErrorCodes.USER_DOES_NOT_EXIST]: {
    get title() {
      return translate("web.user_does_not_exist");
    },
    message: (email = undefined) => (
      <div>
        {translate("web.no_account_found")}
        <Link
          className="font-medium underline underline-offset-4 transition-all hover:font-bold"
          to={`/${email ? `?email=${encodeURIComponent(email)}` : ``}`}
        >
          {translate("web.create_one")}
        </Link>
        &nbsp;to get started.
      </div>
    ),
  },
  [EAuthenticationErrorCodes.REQUIRED_EMAIL_PASSWORD_SIGN_IN]: {
    get title() {
      return translate("web.email_and_password_required");
    },
    message: () => `Email and password required. Please try again.`,
  },
  [EAuthenticationErrorCodes.AUTHENTICATION_FAILED_SIGN_IN]: {
    get title() {
      return translate("web.authentication_failed");
    },
    message: () => `Authentication failed. Please try again.`,
  },
  [EAuthenticationErrorCodes.INVALID_EMAIL_SIGN_IN]: {
    get title() {
      return translate("web.invalid_email");
    },
    message: () => `Invalid email. Please try again.`,
  },
  [EAuthenticationErrorCodes.MAGIC_SIGN_IN_EMAIL_CODE_REQUIRED]: {
    get title() {
      return translate("web.email_and_code_required");
    },
    message: () => `Email and code required. Please try again.`,
  },
  [EAuthenticationErrorCodes.INVALID_EMAIL_MAGIC_SIGN_IN]: {
    get title() {
      return translate("web.invalid_email");
    },
    message: () => `Invalid email. Please try again.`,
  },

  // Both Sign in and Sign up
  [EAuthenticationErrorCodes.INVALID_MAGIC_CODE_SIGN_IN]: {
    get title() {
      return translate("web.authentication_failed");
    },
    message: () => `Invalid magic code. Please try again.`,
  },
  [EAuthenticationErrorCodes.INVALID_MAGIC_CODE_SIGN_UP]: {
    get title() {
      return translate("web.authentication_failed");
    },
    message: () => `Invalid magic code. Please try again.`,
  },
  [EAuthenticationErrorCodes.EXPIRED_MAGIC_CODE_SIGN_IN]: {
    get title() {
      return translate("web.expired_magic_code");
    },
    message: () => `Expired magic code. Please try again.`,
  },
  [EAuthenticationErrorCodes.EXPIRED_MAGIC_CODE_SIGN_UP]: {
    get title() {
      return translate("web.expired_magic_code");
    },
    message: () => `Expired magic code. Please try again.`,
  },
  [EAuthenticationErrorCodes.EMAIL_CODE_ATTEMPT_EXHAUSTED_SIGN_IN]: {
    get title() {
      return translate("web.expired_magic_code");
    },
    message: () => `Expired magic code. Please try again.`,
  },
  [EAuthenticationErrorCodes.EMAIL_CODE_ATTEMPT_EXHAUSTED_SIGN_UP]: {
    get title() {
      return translate("web.expired_magic_code");
    },
    message: () => `Expired magic code. Please try again.`,
  },

  // Oauth
  [EAuthenticationErrorCodes.OAUTH_NOT_CONFIGURED]: {
    get title() {
      return translate("web.oauth_not_configured");
    },
    message: () => `OAuth not configured. Please contact your administrator.`,
  },
  [EAuthenticationErrorCodes.GOOGLE_NOT_CONFIGURED]: {
    get title() {
      return translate("web.google_not_configured");
    },
    message: () => `Google not configured. Please contact your administrator.`,
  },
  [EAuthenticationErrorCodes.GITHUB_NOT_CONFIGURED]: {
    get title() {
      return translate("web.github_not_configured");
    },
    message: () => `GitHub not configured. Please contact your administrator.`,
  },
  [EAuthenticationErrorCodes.GITLAB_NOT_CONFIGURED]: {
    get title() {
      return translate("web.gitlab_not_configured");
    },
    message: () => `GitLab not configured. Please contact your administrator.`,
  },
  [EAuthenticationErrorCodes.GOOGLE_OAUTH_PROVIDER_ERROR]: {
    get title() {
      return translate("web.google_oauth_provider_error");
    },
    message: () => `Google OAuth provider error. Please try again.`,
  },
  [EAuthenticationErrorCodes.GITHUB_OAUTH_PROVIDER_ERROR]: {
    get title() {
      return translate("web.github_oauth_provider_error");
    },
    message: () => `GitHub OAuth provider error. Please try again.`,
  },
  [EAuthenticationErrorCodes.GITLAB_OAUTH_PROVIDER_ERROR]: {
    get title() {
      return translate("web.gitlab_oauth_provider_error");
    },
    message: () => `GitLab OAuth provider error. Please try again.`,
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
    message: () => `Invalid password token. Please try again.`,
  },
  [EAuthenticationErrorCodes.EXPIRED_PASSWORD_TOKEN]: {
    get title() {
      return translate("web.expired_password_token");
    },
    message: () => `Expired password token. Please try again.`,
  },

  // Change password
  [EAuthenticationErrorCodes.MISSING_PASSWORD]: {
    get title() {
      return translate("web.password_required");
    },
    message: () => `Password required. Please try again.`,
  },
  [EAuthenticationErrorCodes.INCORRECT_OLD_PASSWORD]: {
    get title() {
      return translate("web.incorrect_old_password");
    },
    message: () => `Incorrect old password. Please try again.`,
  },
  [EAuthenticationErrorCodes.INVALID_NEW_PASSWORD]: {
    get title() {
      return translate("web.invalid_new_password");
    },
    message: () => `Invalid new password. Please try again.`,
  },

  // set password
  [EAuthenticationErrorCodes.PASSWORD_ALREADY_SET]: {
    get title() {
      return translate("web.password_already_set");
    },
    message: () => `Password already set. Please try again.`,
  },

  // admin
  [EAuthenticationErrorCodes.ADMIN_ALREADY_EXIST]: {
    get title() {
      return translate("web.admin_already_exists");
    },
    message: () => `Admin already exists. Please try again.`,
  },
  [EAuthenticationErrorCodes.REQUIRED_ADMIN_EMAIL_PASSWORD_FIRST_NAME]: {
    get title() {
      return translate("web.email_password_and_first_name_required");
    },
    message: () => `Email, password and first name required. Please try again.`,
  },
  [EAuthenticationErrorCodes.INVALID_ADMIN_EMAIL]: {
    get title() {
      return translate("web.invalid_admin_email");
    },
    message: () => `Invalid admin email. Please try again.`,
  },
  [EAuthenticationErrorCodes.INVALID_ADMIN_PASSWORD]: {
    get title() {
      return translate("web.invalid_admin_password");
    },
    message: () => `Invalid admin password. Please try again.`,
  },
  [EAuthenticationErrorCodes.REQUIRED_ADMIN_EMAIL_PASSWORD]: {
    get title() {
      return translate("web.email_and_password_required");
    },
    message: () => `Email and password required. Please try again.`,
  },
  [EAuthenticationErrorCodes.ADMIN_AUTHENTICATION_FAILED]: {
    get title() {
      return translate("web.authentication_failed");
    },
    message: () => `Authentication failed. Please try again.`,
  },
  [EAuthenticationErrorCodes.ADMIN_USER_ALREADY_EXIST]: {
    get title() {
      return translate("web.admin_user_already_exists_2");
    },
    message: () => (
      <div>
        {translate("web.admin_user_already_exists")}
        <Link className="font-medium underline underline-offset-4 transition-all hover:font-bold" to={`/admin`}>
          {translate("web.sign_in_2")}
        </Link>
        &nbsp;now.
      </div>
    ),
  },
  [EAuthenticationErrorCodes.ADMIN_USER_DOES_NOT_EXIST]: {
    get title() {
      return translate("web.admin_user_does_not_exist_2");
    },
    message: () => (
      <div>
        {translate("web.admin_user_does_not_exist")}
        <Link className="font-medium underline underline-offset-4 transition-all hover:font-bold" to={`/admin`}>
          {translate("web.sign_in_2")}
        </Link>
        &nbsp;now.
      </div>
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
