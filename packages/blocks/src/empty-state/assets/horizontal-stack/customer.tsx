/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ILLUSTRATION_COLOR_TOKEN_MAP } from "../helper";

export type CustomerHorizontalStackIllustrationProps = {
  className?: string;
};

export function CustomerHorizontalStackIllustration({ className }: CustomerHorizontalStackIllustrationProps) {
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
          d="M47.6 2.4C46.7 1.9 45.5 1.9 44.3 2.6L9 20.5C6.1 22 3.8 26.1 3.8 29.6V72.5C3.8 74.4 4.5 75.8 5.6 76.4L2.1 74.6C1 74 0.3 72.7 0.3 70.7V27.8C0.3 24.3 2.6 20.2 5.5 18.7L40.7 0.8C42 0.1 43.2 0.1 44.1 0.6L47.6 2.4Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M47.6 2.4C48.8 2.9 49.5 4.3 49.5 6.3V49.2C49.5 52.7 47.1 56.8 44.3 58.2L9 76.2C7.7 76.8 6.5 76.9 5.6 76.4C4.5 75.8 3.8 74.4 3.8 72.5V29.6C3.8 26.1 6.1 22 9 20.5L44.3 2.6C45.5 1.9 46.7 1.9 47.6 2.4Z"
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
          d="M63 9.1C64.2 9.7 64.9 11.1 64.9 13.1V56C64.9 59.5 62.5 63.6 59.6 65L24.4 83C23.1 83.6 21.9 83.7 21 83.2C19.9 82.6 19.1 81.2 19.1 79.3V36.4C19.1 32.9 21.5 28.8 24.4 27.3L59.6 9.4C60.9 8.7 62.1 8.7 63 9.1Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <path
        d="M78.4 15.9C77.5 15.5 76.3 15.5 75 16.2L39.8 34.1C36.9 35.6 34.5 39.7 34.5 43.2V86.1C34.5 88 35.2 89.4 36.4 90L32.9 88.2C31.7 87.6 31 86.2 31 84.3V41.4C31 37.9 33.4 33.8 36.2 32.3L71.5 14.4C72.8 13.7 74 13.7 74.9 14.2L78.4 15.9Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M78.4 15.9C79.5 16.5 80.3 17.9 80.3 19.9V62.8C80.3 66.3 77.9 70.3 75 71.8L39.8 89.8C38.5 90.4 37.3 90.5 36.4 90C35.2 89.4 34.5 88 34.5 86.1V43.2C34.5 39.6 36.9 35.6 39.8 34.1L75 16.2C76.3 15.5 77.5 15.5 78.4 15.9Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M46.4 45.3C46.4 44.7 46.8 44 47.3 43.7L62.5 35.9C63 35.7 63.5 36 63.5 36.6C63.5 37.3 63 38 62.5 38.3V42.9L70.1 39C70.6 38.7 71.1 39 71.1 39.7C71.1 40.3 70.6 41 70.1 41.3V59.8L71.1 59.3C71.6 59.1 72 59.4 72 60C72 60.6 71.6 61.4 71.1 61.6L46.4 74.2C45.8 74.5 45.4 74.2 45.4 73.6C45.4 72.9 45.8 72.2 46.4 71.9L47.3 71.4V46C46.8 46.3 46.4 46 46.4 45.3L46.4 45.3ZM49.2 45V70.5L51.1 69.5V65.4C51.1 63.8 52.2 62 53.5 61.3L56.3 59.9C57.7 59.2 58.7 60 58.7 61.6V65.6L60.6 64.6V39.2L49.2 45L49.2 45ZM62.5 45.2V63.7L68.2 60.8V42.3L62.5 45.2ZM56.8 66.6V62.5C56.8 62.2 56.6 62.1 56.3 62.2L53.5 63.6C53.2 63.8 53 64.2 53 64.5V68.5L56.8 66.6ZM51.1 48.7C51.1 48 51.5 47.3 52.1 47L53 46.6C53.5 46.3 54 46.6 54 47.2C54 47.9 53.5 48.6 53 48.9L52.1 49.4C51.5 49.6 51.1 49.3 51.1 48.7ZM55.9 46.3C55.9 45.6 56.3 44.9 56.8 44.6L57.8 44.1C58.3 43.9 58.7 44.2 58.7 44.8C58.7 45.5 58.3 46.2 57.8 46.5L56.8 46.9C56.3 47.2 55.9 46.9 55.9 46.3ZM51.1 53.3C51.1 52.7 51.5 51.9 52.1 51.7L53 51.2C53.5 50.9 54 51.2 54 51.9C54 52.5 53.5 53.2 53 53.5L52.1 54C51.5 54.2 51.1 53.9 51.1 53.3ZM55.9 50.9C55.9 50.2 56.3 49.5 56.8 49.2L57.8 48.8C58.3 48.5 58.7 48.8 58.7 49.4C58.7 50.1 58.3 50.8 57.8 51.1L56.8 51.6C56.3 51.8 55.9 51.5 55.9 50.9ZM64.4 48.8C64.4 48.2 64.8 47.5 65.4 47.2H65.4C65.9 46.9 66.3 47.2 66.3 47.9V47.9C66.3 48.5 65.9 49.3 65.4 49.5H65.4C64.8 49.8 64.4 49.5 64.4 48.9V48.8ZM51.1 57.9C51.1 57.3 51.5 56.6 52.1 56.3L53 55.8C53.5 55.5 54 55.8 54 56.5C54 57.1 53.5 57.8 53 58.1L52.1 58.6C51.5 58.9 51.1 58.6 51.1 57.9ZM55.9 55.5C55.9 54.9 56.3 54.1 56.8 53.9L57.8 53.4C58.3 53.1 58.7 53.4 58.7 54.1C58.7 54.7 58.3 55.4 57.8 55.7L56.8 56.2C56.3 56.5 55.9 56.2 55.9 55.5ZM64.4 53.5C64.4 52.8 64.8 52.1 65.4 51.8H65.4C65.9 51.6 66.3 51.9 66.3 52.5V52.5C66.3 53.1 65.9 53.9 65.4 54.1H65.4C64.8 54.4 64.4 54.1 64.4 53.5V53.5ZM64.4 58.1C64.4 57.5 64.8 56.7 65.4 56.5H65.4C65.9 56.2 66.3 56.5 66.3 57.1V57.1C66.3 57.8 65.9 58.5 65.4 58.8H65.4C64.8 59 64.4 58.7 64.4 58.1V58.1Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
    </svg>
  );
}
