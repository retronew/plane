/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ILLUSTRATION_COLOR_TOKEN_MAP } from "../helper";

export type UpdateHorizontalStackIllustrationProps = {
  className?: string;
};

export function UpdateHorizontalStackIllustration({ className }: UpdateHorizontalStackIllustrationProps) {
  return (
    <svg
      width="72"
      height="81"
      viewBox="0 0 72 81"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <g opacity="0.2">
        <path
          d="M42.5 2.9C41.7 2.5 40.6 2.5 39.5 3.1L8.7 18.8C6.1 20.1 4.1 23.7 4.1 26.7V64.3C4.1 66 4.7 67.2 5.7 67.7L2.6 66.2C1.6 65.6 1 64.4 1 62.7V25.2C1 22.1 3.1 18.5 5.6 17.3L36.4 1.5C37.6 1 38.6 0.9 39.4 1.4L42.5 2.9Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.35"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M42.5 2.9C43.5 3.4 44.1 4.6 44.1 6.4V43.9C44.1 47 42 50.5 39.5 51.8L8.7 67.5C7.5 68.1 6.5 68.1 5.7 67.7C4.7 67.2 4.1 66 4.1 64.3V26.7C4.1 23.7 6.1 20.1 8.7 18.8L39.5 3.1C40.6 2.5 41.7 2.5 42.5 2.9Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.35"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <g opacity="0.6">
        <path
          d="M55.9 8.9C55.1 8.5 54.1 8.5 53 9.1L22.1 24.8C19.6 26.1 17.5 29.7 17.5 32.7V70.3C17.5 72 18.2 73.2 19.2 73.7L16.1 72.1C15.1 71.6 14.5 70.4 14.5 68.7V31.2C14.5 28.1 16.5 24.5 19 23.2L49.9 7.5C51 7 52 6.9 52.8 7.3L55.9 8.9Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.35"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M55.9 8.9C56.9 9.4 57.5 10.6 57.5 12.3V49.9C57.5 53 55.5 56.5 53 57.8L22.1 73.5C21 74.1 20 74.1 19.2 73.7C18.2 73.2 17.5 72 17.5 70.3V32.7C17.5 29.6 19.6 26.1 22.1 24.8L53 9.1C54.1 8.5 55.1 8.5 55.9 8.9Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.35"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <path
        d="M69.4 14.8C68.6 14.4 67.5 14.5 66.4 15L35.6 30.8C33 32 31 35.6 31 38.7V76.2C31 77.9 31.6 79.1 32.6 79.6L29.5 78.1C28.5 77.6 27.9 76.4 27.9 74.6V37.1C27.9 34 30 30.5 32.5 29.2L63.3 13.5C64.5 12.9 65.5 12.9 66.3 13.3L69.4 14.8Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M69.4 14.8C70.4 15.4 71 16.6 71 18.3V55.8C71 58.9 68.9 62.5 66.4 63.7L35.6 79.5C34.4 80 33.4 80.1 32.6 79.6C31.6 79.1 31 77.9 31 76.2V38.7C31 35.6 33 32 35.6 30.8L66.4 15C67.5 14.5 68.6 14.4 69.4 14.8Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M48.6 44.3C51.2 39.1 55.1 34.6 59.5 32.3C59.9 32.1 60.2 32.3 60.2 32.8C60.2 38.2 58.1 44 54.9 48.7C55.4 52.4 53.2 57.2 50 59.5C49.7 59.7 49.3 59.9 49 60.1C48.7 60.2 48.4 60 48.4 59.6V55.2C47.5 54.8 46.8 54.3 46.1 53.6L42.5 55.4C42.1 55.6 41.8 55.4 41.8 54.9C41.8 51 44.5 46.4 47.7 44.7C48 44.6 48.3 44.4 48.6 44.3ZM53.6 40.9C52.5 41.5 51.7 43 51.7 44.3C51.7 45.7 52.5 46.3 53.6 45.7C54.7 45.2 55.6 43.6 55.6 42.3C55.6 41 54.7 40.4 53.6 40.9Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
      />
      <path
        d="M45.1 56.4C45.4 56 45.4 55.5 45.2 55.3C45 55 44.6 55.2 44.3 55.6C42.9 57.5 42.2 59.9 42.5 61.8C42.6 62.2 42.8 62.3 43.1 62.2C44.7 61.7 46.4 60 47.5 57.8C47.7 57.3 47.6 56.9 47.3 56.7C47 56.6 46.6 56.9 46.4 57.3C46.4 57.4 46.4 57.4 46.4 57.4C45.8 58.7 44.8 59.8 43.8 60.3C43.8 59 44.3 57.6 45.1 56.4Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
      />
    </svg>
  );
}
