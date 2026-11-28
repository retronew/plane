/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ILLUSTRATION_COLOR_TOKEN_MAP } from "../helper";

export type LabelHorizontalStackIllustrationProps = {
  className?: string;
};

export function LabelHorizontalStackIllustration({ className }: LabelHorizontalStackIllustrationProps) {
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
          d="M47.6 2.4C48.8 3 49.5 4.4 49.5 6.4V49.9C49.5 53.4 47.1 57.5 44.2 59L9 77.2C7.7 77.9 6.5 77.9 5.6 77.5C4.5 76.9 3.8 75.5 3.8 73.5V30C3.8 26.4 6.1 22.3 9 20.8L44.3 2.6C45.5 1.9 46.7 1.9 47.6 2.4Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <g opacity="0.6">
        <path
          d="M63 9.3C62.1 8.8 60.9 8.8 59.6 9.5L24.4 27.7C21.5 29.2 19.1 33.3 19.1 36.9V80.4C19.1 82.4 19.9 83.8 21 84.4L17.5 82.5C16.4 81.9 15.6 80.5 15.6 78.5V35.1C15.6 31.5 18 27.4 20.9 25.9L56.1 7.7C57.4 7 58.6 7 59.5 7.5L63 9.3Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M63 9.3C64.1 9.9 64.9 11.3 64.9 13.3V56.7C64.9 60.3 62.5 64.4 59.6 65.9L24.4 84.1C23.1 84.8 21.9 84.8 21 84.4C19.9 83.8 19.1 82.4 19.1 80.4V36.9C19.1 33.3 21.5 29.2 24.4 27.7L59.6 9.5C60.9 8.8 62.1 8.8 63 9.3Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <path
        d="M78.4 16.2C77.5 15.7 76.3 15.7 75 16.4L39.8 34.6C36.9 36.1 34.5 40.2 34.5 43.8V87.3C34.5 89.3 35.3 90.7 36.4 91.3L32.9 89.4C31.7 88.8 31 87.4 31 85.4V42C31 38.4 33.4 34.3 36.3 32.8L71.5 14.6C72.8 13.9 74 13.9 74.9 14.4L78.4 16.2Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M78.4 16.2C79.5 16.8 80.3 18.2 80.3 20.2V63.6C80.3 67.2 77.9 71.3 75 72.8L39.8 91C38.5 91.7 37.3 91.7 36.4 91.2C35.3 90.7 34.5 89.2 34.5 87.3V43.8C34.5 40.2 36.9 36.1 39.8 34.6L75 16.4C76.3 15.7 77.5 15.7 78.4 16.2Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M49.6 47.9C50.2 46.8 51 46 51.8 45.5L59.5 41.6C60.4 41.1 61.2 41.1 61.8 41.5L71.2 48.2C71.8 48.7 72.2 49.7 72.2 50.9C72.2 52.1 71.8 53.4 71.2 54.6L64.1 67C63.4 68.2 62.5 69.2 61.5 69.7C60.5 70.2 59.6 70.2 58.9 69.7L49.6 63C49 62.6 48.6 61.7 48.6 60.7V51.2C48.6 50.1 49 48.9 49.6 47.9L49.6 47.9ZM51.8 48.2C51.6 48.3 51.3 48.6 51.1 49C50.9 49.3 50.8 49.7 50.8 50.1V59.6C50.8 59.9 50.9 60.2 51.1 60.3L60.4 67C60.7 67.2 61.1 67.2 61.5 67C61.9 66.8 62.3 66.4 62.6 65.9L69.6 53.6C69.9 53.1 70.1 52.5 70.1 52C70.1 51.5 69.9 51.1 69.6 50.9L60.3 44.2C60.1 44.1 59.8 44.1 59.5 44.2L51.8 48.2L51.8 48.2Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        d="M59.5 51.2C59.5 53.4 58.1 55.9 56.3 56.8C54.5 57.7 53.1 56.7 53.1 54.5C53.1 52.3 54.5 49.8 56.3 48.8C58.1 47.9 59.5 49 59.5 51.2Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
    </svg>
  );
}
