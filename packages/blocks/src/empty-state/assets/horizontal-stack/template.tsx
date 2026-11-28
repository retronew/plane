/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ILLUSTRATION_COLOR_TOKEN_MAP } from "../helper";

export type TemplateHorizontalStackIllustrationProps = {
  className?: string;
};

export function TemplateHorizontalStackIllustration({ className }: TemplateHorizontalStackIllustrationProps) {
  return (
    <svg
      width="81"
      height="92"
      viewBox="0 0 81 92"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <g opacity="0.2">
        <path
          d="M47.6 2.4C46.7 1.9 45.5 2 44.3 2.6L9 20.8C6.1 22.3 3.8 26.4 3.8 30V73.5C3.8 75.5 4.5 76.9 5.6 77.5L2.1 75.6C1 75.1 0.3 73.6 0.3 71.7V28.2C0.3 24.6 2.6 20.5 5.5 19L40.7 0.8C42 0.1 43.2 0.1 44.1 0.6L47.6 2.4Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M47.6 2.4C48.8 3 49.5 4.4 49.5 6.4V49.9C49.5 53.4 47.1 57.5 44.3 59L9 77.2C7.7 77.9 6.5 77.9 5.6 77.5C4.5 76.9 3.8 75.5 3.8 73.5V30C3.8 26.4 6.1 22.3 9 20.8L44.3 2.6C45.5 1.9 46.7 1.9 47.6 2.4Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <g opacity="0.6">
        <path
          d="M63 9.3C62.1 8.8 60.9 8.9 59.6 9.5L24.4 27.8C21.5 29.2 19.1 33.4 19.1 36.9V80.4C19.1 82.4 19.9 83.8 21 84.4L17.5 82.6C16.4 82 15.6 80.6 15.6 78.6V35.1C15.6 31.5 18 27.4 20.9 25.9L56.1 7.7C57.4 7.1 58.6 7 59.5 7.5L63 9.3Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M63 9.3C64.2 9.9 64.9 11.3 64.9 13.3V56.8C64.9 60.4 62.5 64.5 59.6 66L24.4 84.2C23.1 84.8 21.9 84.9 21 84.4C19.9 83.8 19.1 82.4 19.1 80.4V36.9C19.1 33.4 21.5 29.2 24.4 27.8L59.6 9.5C60.9 8.9 62.1 8.8 63 9.3Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <path
        d="M78.4 16.2C77.5 15.7 76.3 15.8 75 16.4L39.8 34.6C36.9 36.1 34.5 40.2 34.5 43.8V87.3C34.5 89.3 35.2 90.7 36.4 91.3L32.9 89.5C31.7 88.9 31 87.5 31 85.5V42C31 38.4 33.4 34.3 36.2 32.8L71.5 14.6C72.8 14 74 13.9 74.9 14.4L78.4 16.2Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M78.4 16.2C79.5 16.8 80.3 18.2 80.3 20.2V63.7C80.3 67.3 77.9 71.4 75 72.9L39.8 91.1C38.5 91.7 37.3 91.8 36.4 91.3C35.2 90.7 34.5 89.3 34.5 87.3V43.8C34.5 40.2 36.9 36.1 39.8 34.6L75 16.4C76.3 15.8 77.5 15.7 78.4 16.2Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M59.1 41.4L55.4 50.5L62.8 46.7L59.1 41.4V41.4ZM59.1 38.2C59.4 38 59.7 37.9 60 38C60.3 38 60.6 38.1 60.8 38.4L60.8 38.4L65 44.6C65.2 44.9 65.3 45.2 65.4 45.6C65.4 46.1 65.3 46.5 65.1 47C65 47.5 64.7 47.9 64.4 48.3C64.1 48.7 63.8 49 63.4 49.2L54.9 53.6C54.5 53.8 54.2 53.9 53.9 53.8C53.6 53.8 53.3 53.6 53.1 53.3C53 53 52.9 52.6 52.9 52.2C52.9 51.7 53 51.2 53.2 50.8L57.5 40.2C57.6 39.8 57.9 39.4 58.1 39C58.4 38.6 58.7 38.4 59.1 38.2L59.1 38.2Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M47.6 63C47.6 61.5 48.7 59.7 49.9 59L55.7 56C56.9 55.4 58 56.1 58 57.7V64.8C58 66.4 56.9 68.2 55.7 68.8L49.9 71.8C48.7 72.4 47.6 71.7 47.6 70.1V63ZM55.7 58.9L49.9 61.8V68.9L55.7 66V58.9Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M65.4 53.8C63.9 54.6 62.6 56.9 62.6 58.9C62.6 60.8 63.9 61.7 65.4 60.9C67 60.1 68.3 57.9 68.3 55.9C68.3 53.9 67 53 65.4 53.8ZM60.3 60C60.3 56.5 62.6 52.5 65.4 51C68.3 49.5 70.6 51.2 70.6 54.7C70.6 58.2 68.3 62.3 65.4 63.8C62.6 65.2 60.3 63.6 60.3 60Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
    </svg>
  );
}
