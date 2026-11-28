/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ILLUSTRATION_COLOR_TOKEN_MAP } from "../helper";

export type WorklogHorizontalStackIllustrationProps = {
  className?: string;
};

export function WorklogHorizontalStackIllustration({ className }: WorklogHorizontalStackIllustrationProps) {
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
        d="M78.4 15.9C79.5 16.5 80.3 17.9 80.3 19.9V62.8C80.3 66.3 77.9 70.3 75 71.8L39.8 89.8C38.5 90.4 37.3 90.5 36.4 90C35.3 89.4 34.5 88 34.5 86.1V43.2C34.5 39.6 36.9 35.6 39.8 34.1L75 16.2C76.3 15.5 77.5 15.5 78.4 15.9Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M61.5 39.4L57.1 41.6C56.5 41.9 56 41.5 56 40.8C56 40.1 56.5 39.2 57.1 38.9L61.5 36.7C62.1 36.4 62.6 36.7 62.6 37.5C62.6 38.2 62.1 39.1 61.5 39.4Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        d="M59.3 56.4C59 56.5 58.7 56.6 58.5 56.4C58.1 56.1 58.1 55.3 58.5 54.5L61.8 48.9C62.2 48.1 62.9 47.8 63.3 48.1C63.8 48.4 63.8 49.2 63.3 50L60.1 55.6C59.9 56 59.6 56.2 59.3 56.4L59.3 56.4Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        d="M59.3 67C53.9 69.8 49.5 66.7 49.5 60.1C49.5 53.5 53.9 45.9 59.3 43.1C64.7 40.4 69.1 43.5 69.1 50.1C69.1 56.7 64.7 64.3 59.3 67ZM59.3 45.8C55.1 47.9 51.7 53.8 51.7 59C51.7 64.1 55.1 66.5 59.3 64.4C63.5 62.2 66.9 56.3 66.9 51.2C66.9 46.1 63.5 43.6 59.3 45.8Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
    </svg>
  );
}
