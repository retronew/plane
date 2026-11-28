/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ILLUSTRATION_COLOR_TOKEN_MAP } from "../helper";

export type WebhookHorizontalStackIllustrationProps = {
  className?: string;
};

export function WebhookHorizontalStackIllustration({ className }: WebhookHorizontalStackIllustrationProps) {
  return (
    <svg
      width="81"
      height="91"
      viewBox="0 0 81 91"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <g opacity="0.2">
        <path
          d="M47.6 2.4C46.7 1.9 45.5 1.9 44.3 2.6L9 20.5C6.1 22 3.8 26.1 3.8 29.6V72.5C3.8 74.4 4.5 75.8 5.6 76.4L2.1 74.6C1 74 0.3 72.6 0.3 70.7V27.8C0.3 24.3 2.6 20.2 5.5 18.7L40.7 0.8C42 0.1 43.2 0.1 44.1 0.6L47.6 2.4Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M47.6 2.4C48.8 2.9 49.5 4.3 49.5 6.3V49.2C49.5 52.7 47.1 56.8 44.2 58.2L9 76.2C7.7 76.8 6.5 76.9 5.6 76.4C4.5 75.8 3.8 74.4 3.8 72.5V29.6C3.8 26.1 6.1 22 9 20.5L44.3 2.6C45.5 1.9 46.7 1.9 47.6 2.4Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <g opacity="0.6">
        <path
          d="M63 9.2C62.1 8.7 60.9 8.7 59.6 9.4L24.4 27.3C21.5 28.8 19.1 32.9 19.1 36.4V79.3C19.1 81.2 19.9 82.6 21 83.2L17.5 81.4C16.4 80.8 15.6 79.4 15.6 77.5V34.6C15.6 31.1 18 27 20.9 25.5L56.1 7.6C57.4 6.9 58.6 6.9 59.5 7.4L63 9.2Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M63 9.1C64.1 9.7 64.9 11.1 64.9 13.1V56C64.9 59.5 62.5 63.5 59.6 65L24.4 83C23.1 83.6 21.9 83.7 21 83.2C19.9 82.6 19.1 81.2 19.1 79.3V36.4C19.1 32.9 21.5 28.8 24.4 27.3L59.6 9.4C60.9 8.7 62.1 8.7 63 9.1Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <path
        d="M78.4 15.9C77.5 15.5 76.3 15.5 75 16.2L39.8 34.1C36.9 35.6 34.5 39.7 34.5 43.2V86.1C34.5 88 35.3 89.4 36.4 90L32.9 88.2C31.7 87.6 31 86.2 31 84.3V41.4C31 37.9 33.4 33.8 36.3 32.3L71.5 14.4C72.8 13.7 74 13.7 74.9 14.2L78.4 15.9Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M78.4 15.9C79.5 16.5 80.2 17.9 80.2 19.9V62.8C80.2 66.3 77.9 70.3 75 71.8L39.8 89.8C38.5 90.4 37.3 90.5 36.4 90C35.3 89.4 34.5 88 34.5 86.1V43.2C34.5 39.6 36.9 35.6 39.8 34.1L75 16.2C76.3 15.5 77.5 15.5 78.4 15.9Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M58.2 43.9C58.7 43.3 59.3 43.1 59.6 43.6L59.7 43.6L63.1 49.5L63.2 49.6C63.5 50 64.2 49.9 65.3 49.4L65.6 49.3C66.9 48.7 68.2 48.7 69.1 49.4C70.2 50.1 70.8 51.5 70.8 53.3C70.8 55 70.2 57 69.1 58.8C68.1 60.6 66.7 62 65.3 62.7C64.7 63 64.2 62.7 64.2 61.9C64.2 61.2 64.7 60.4 65.3 60.1C66.2 59.6 67 58.8 67.6 57.7C68.2 56.6 68.6 55.5 68.6 54.4C68.6 53.3 68.2 52.5 67.6 52.1C67.1 51.7 66.4 51.6 65.6 51.9L65.3 52.1C64.1 52.7 62.2 53.3 61.3 51.9L61.2 51.8L57.8 45.9L57.7 45.8C57.5 45.3 57.7 44.5 58.2 43.9L58.2 43.9ZM47.5 61.6C47.9 60.9 48.5 60.4 49 60.6C49.5 60.7 49.7 61.4 49.3 62.2L49.2 62.5C49 63.1 48.9 63.8 48.9 64.4C48.9 65.3 49.1 66 49.6 66.5C50 67 50.7 67.2 51.4 67C52.1 66.9 52.8 66.4 53.5 65.7C54.2 65 54.7 64.1 55.1 63.1V63.1C55.7 61.5 56.9 59 58.7 58L65.3 54.7L65.4 54.6C66 54.4 66.4 54.8 66.4 55.5C66.4 56.2 65.9 56.9 65.4 57.3L65.3 57.4L58.7 60.7C58.2 61 57.5 61.9 57 63.4C56.4 65 55.5 66.5 54.4 67.7C53.3 68.8 52 69.6 50.9 69.9C49.7 70.1 48.6 69.8 47.9 69C47.1 68.2 46.7 67 46.7 65.5V65.5L46.7 65.1C46.8 64 47 62.9 47.5 61.8L47.6 61.6L47.5 61.6ZM58 38.5C58.7 38 59.5 37.7 60.2 37.6C60.9 37.5 61.6 37.5 62.1 37.8C62.6 38 63.1 38.4 63.4 38.9L63.5 39.1L63.6 39.3C63.8 39.8 63.6 40.6 63.1 41.1C62.6 41.6 62.1 41.8 61.7 41.5L61.6 41.3L61.4 41.1C61.3 40.9 61 40.7 60.8 40.6C60.4 40.4 60 40.4 59.6 40.4C59.2 40.5 58.8 40.7 58.3 41C57.9 41.3 57.5 41.7 57.1 42.1C56.7 42.6 56.4 43.1 56.1 43.7C55.9 44.3 55.7 44.8 55.6 45.4C55.5 46 55.5 46.5 55.5 47C55.6 47.5 55.7 47.9 56 48.3C56.3 48.8 56.7 49.4 56.9 50.3C57 51.1 57 52.2 56.6 53.4L53.1 62.9L53.1 63C52.8 63.7 52.2 64.2 51.7 64.2C51.1 64.1 50.9 63.4 51.2 62.6L54.6 53.2L54.7 53C54.8 52.7 54.8 52.3 54.7 51.9C54.6 51.6 54.5 51.3 54.3 50.9L54.1 50.6C54.1 50.6 54.1 50.6 54.1 50.6C53.7 50.1 53.5 49.4 53.4 48.5C53.2 47.7 53.3 46.8 53.4 45.9C53.6 44.9 53.9 43.9 54.4 43C54.8 42.1 55.4 41.2 56 40.4C56.6 39.6 57.3 39 58 38.5H58Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
    </svg>
  );
}
