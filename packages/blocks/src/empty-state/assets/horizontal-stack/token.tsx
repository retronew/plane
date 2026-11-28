/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ILLUSTRATION_COLOR_TOKEN_MAP } from "../helper";

export type TokenHorizontalStackIllustrationProps = {
  className?: string;
};

export function TokenHorizontalStackIllustration({ className }: TokenHorizontalStackIllustrationProps) {
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
          d="M47.6 2.4C46.7 1.9 45.5 1.9 44.3 2.6L9 20.5C6.1 22 3.8 26.1 3.8 29.6V72.5C3.8 74.4 4.5 75.8 5.6 76.4L2.1 74.6C1 74 0.3 72.6 0.3 70.7V27.8C0.3 24.3 2.6 20.2 5.5 18.7L40.7 0.8C42 0.1 43.2 0.1 44.1 0.6L47.6 2.4H47.6Z"
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
          d="M63 9.2C62.1 8.7 60.9 8.8 59.6 9.4L24.4 27.4C21.5 28.9 19.1 32.9 19.1 36.4V79.3C19.1 81.3 19.9 82.7 21 83.2L17.5 81.5C16.4 80.9 15.6 79.5 15.6 77.5V34.6C15.6 31.1 18 27.1 20.9 25.6L56.1 7.6C57.4 7 58.6 6.9 59.5 7.4L63 9.2Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M63 9.2C64.1 9.8 64.9 11.2 64.9 13.1V56C64.9 59.5 62.5 63.6 59.6 65.1L24.4 83C23.1 83.7 21.9 83.7 21 83.2C19.9 82.7 19.1 81.3 19.1 79.3V36.4C19.1 32.9 21.5 28.9 24.4 27.4L59.6 9.4C60.9 8.8 62.1 8.7 63 9.2Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <path
        d="M78.4 16C77.5 15.5 76.3 15.6 75 16.2L39.8 34.2C36.9 35.6 34.5 39.7 34.5 43.2V86.1C34.5 88.1 35.3 89.5 36.4 90L32.9 88.3C31.7 87.7 31 86.3 31 84.3V41.4C31 37.9 33.4 33.9 36.3 32.4L71.5 14.4C72.8 13.8 74 13.7 74.9 14.2L78.4 16Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M78.4 16C79.5 16.6 80.3 18 80.3 19.9V62.8C80.3 66.3 77.9 70.4 75 71.9L39.8 89.8C38.5 90.5 37.3 90.5 36.4 90C35.3 89.5 34.5 88.1 34.5 86.1V43.2C34.5 39.7 36.9 35.6 39.8 34.2L75 16.2C76.3 15.6 77.5 15.5 78.4 16Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M53.2 71.8L50.2 73.3C49.1 73.9 48.2 73.2 48.2 71.9V69.3C48.2 68.3 48.5 67.2 49.1 66.2L55.4 55.2C55.1 53.7 55.1 51.8 55.6 49.9C57 44.5 61.3 39.8 65.1 39.4C67 39.3 68.6 40.2 69.4 41.9C70.3 43.6 70.4 46.1 69.8 48.7C68.5 53.8 64.6 58.3 60.8 59.1L60.4 59.7C59.9 60.7 59.1 61.5 58.3 61.9L58.2 62V63.2C58.2 64.5 57.3 66.1 56.2 66.6L55.2 67.1V68.3C55.2 69.7 54.3 71.2 53.2 71.8ZM62.7 42.6C60.4 43.8 58.3 46.6 57.5 49.7C57.1 51.4 57.1 52.9 57.5 54.1C57.6 54.5 57.5 55 57.3 55.5L50.5 67.2C50.3 67.6 50.2 67.9 50.2 68.3V70.9L53.2 69.4V68.2C53.2 66.8 54.1 65.3 55.2 64.7L56.2 64.2V63C56.2 61.6 57.1 60.1 58.2 59.5L58.3 59.5C58.6 59.3 58.9 59.1 59 58.7L59.8 57.3C60.1 56.9 60.5 56.5 60.9 56.5C63.7 56.3 66.9 52.8 67.9 48.8C68.3 46.9 68.3 45.1 67.6 43.9C67 42.6 65.9 41.9 64.5 42.1C63.9 42.1 63.3 42.3 62.7 42.6H62.7Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        d="M63.6 47C63.9 46.9 64.1 47 64.1 47.4C64.1 47.7 63.9 48.1 63.6 48.2C63.4 48.4 63.2 48.2 63.2 47.9C63.2 47.6 63.4 47.2 63.6 47Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        d="M63.6 49.5C62.8 49.9 62.1 49.4 62.1 48.4C62.1 47.4 62.8 46.2 63.6 45.8C64.5 45.4 65.1 45.9 65.1 46.9C65.1 47.9 64.5 49 63.6 49.5ZM63.6 47C63.4 47.2 63.2 47.6 63.2 47.9C63.2 48.2 63.4 48.4 63.6 48.2C63.9 48.1 64.1 47.7 64.1 47.4C64.1 47.1 63.9 46.9 63.6 47Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
    </svg>
  );
}
