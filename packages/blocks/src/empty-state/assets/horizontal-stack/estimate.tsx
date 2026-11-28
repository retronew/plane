/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ILLUSTRATION_COLOR_TOKEN_MAP } from "../helper";

export type EstimateHorizontalStackIllustrationProps = {
  className?: string;
};

export function EstimateHorizontalStackIllustration({ className }: EstimateHorizontalStackIllustrationProps) {
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
          d="M63 9.1C62.1 8.7 60.9 8.7 59.6 9.4L24.4 27.3C21.5 28.8 19.1 32.9 19.1 36.4V79.3C19.1 81.2 19.9 82.6 21 83.2L17.5 81.4C16.4 80.8 15.6 79.4 15.6 77.5V34.6C15.6 31.1 18 27 20.9 25.5L56.1 7.6C57.4 6.9 58.6 6.9 59.5 7.4L63 9.1Z"
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
        d="M78.4 16C77.5 15.5 76.3 15.5 75 16.2L39.8 34.1C36.9 35.6 34.5 39.7 34.5 43.2V86.1C34.5 88 35.3 89.4 36.4 90L32.9 88.2C31.7 87.6 31 86.2 31 84.3V41.4C31 37.9 33.4 33.8 36.3 32.3L71.5 14.4C72.8 13.7 74 13.7 74.9 14.2L78.4 16Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M78.4 16C79.5 16.5 80.2 17.9 80.2 19.9V62.8C80.2 66.3 77.9 70.3 75 71.8L39.8 89.8C38.5 90.4 37.3 90.5 36.4 90C35.3 89.4 34.5 88 34.5 86.1V43.2C34.5 39.7 36.9 35.6 39.8 34.1L75 16.2C76.3 15.5 77.5 15.5 78.4 16Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M57 40.1C57.5 39.5 58.1 39 58.7 38.7C59.3 38.4 59.8 38.3 60.4 38.4C60.9 38.5 61.3 38.8 61.6 39.2L70.6 53.8C70.8 54.3 71 54.9 71 55.6C71 56.3 70.8 57.1 70.6 57.9C70.3 58.6 69.8 59.4 69.3 60C68.8 60.6 68.2 61.1 67.6 61.4L49.7 70.6C49.1 70.9 48.5 71 48 70.9C47.5 70.8 47.1 70.5 46.8 70C46.5 69.5 46.3 68.9 46.3 68.2C46.3 67.5 46.5 66.7 46.8 65.9L55.8 42.2C56.1 41.4 56.5 40.7 57 40.1H57ZM58.7 41.4C58.5 41.5 58.3 41.7 58.1 41.9C57.9 42.1 57.8 42.3 57.7 42.6L48.7 66.3C48.6 66.5 48.6 66.8 48.6 67C48.6 67.3 48.6 67.5 48.7 67.6C48.8 67.8 49 67.9 49.1 67.9C49.3 67.9 49.5 67.9 49.7 67.8L67.6 58.7C67.8 58.6 68 58.4 68.2 58.2C68.4 58 68.5 57.8 68.6 57.5C68.7 57.2 68.8 57 68.8 56.7C68.8 56.5 68.7 56.3 68.6 56.1L59.6 41.6C59.5 41.4 59.4 41.3 59.2 41.3C59.1 41.3 58.9 41.3 58.7 41.4Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
    </svg>
  );
}
