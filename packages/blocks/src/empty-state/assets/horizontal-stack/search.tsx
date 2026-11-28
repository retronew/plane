/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ILLUSTRATION_COLOR_TOKEN_MAP } from "../helper";

export type SearchHorizontalStackIllustrationProps = {
  className?: string;
};

export function SearchHorizontalStackIllustration({ className }: SearchHorizontalStackIllustrationProps) {
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
          d="M42.3 2C41.4 1.6 40.4 1.7 39.3 2.2L8 18.2C5.4 19.5 3.3 23.1 3.3 26.2V64.3C3.3 66.1 3.9 67.3 5 67.8L1.8 66.2C0.8 65.7 0.2 64.5 0.2 62.7V24.6C0.2 21.5 2.3 17.9 4.8 16.6L36.1 0.7C37.3 0.1 38.3 0 39.1 0.5L42.3 2Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.35042"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M42.3 2C43.3 2.6 43.9 3.8 43.9 5.5V43.6C43.9 46.8 41.8 50.4 39.3 51.7L8 67.6C6.8 68.2 5.8 68.2 5 67.8C3.9 67.3 3.3 66.1 3.3 64.3V26.2C3.3 23.1 5.4 19.5 8 18.2L39.3 2.2C40.4 1.7 41.4 1.6 42.3 2Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.35042"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <g opacity="0.6">
        <path
          d="M55.9 8.1C55.1 7.7 54.1 7.7 52.9 8.3L21.6 24.2C19 25.5 17 29.1 17 32.3V70.4C17 72.1 17.6 73.3 18.6 73.9L15.5 72.3C14.5 71.7 13.8 70.5 13.8 68.8V30.7C13.8 27.5 15.9 23.9 18.5 22.6L49.8 6.7C50.9 6.1 52 6.1 52.8 6.5L55.9 8.1Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.35042"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M55.9 8.1C56.9 8.6 57.6 9.8 57.6 11.6V49.7C57.6 52.8 55.5 56.4 52.9 57.7L21.6 73.7C20.5 74.2 19.4 74.3 18.6 73.9C17.6 73.3 17 72.1 17 70.4V32.3C17 29.1 19 25.5 21.6 24.2L52.9 8.3C54.1 7.7 55.1 7.7 55.9 8.1Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.35042"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <path
        d="M69.6 14.1C68.8 13.7 67.7 13.7 66.6 14.3L35.3 30.3C32.7 31.6 30.6 35.2 30.6 38.3V76.4C30.6 78.1 31.3 79.4 32.3 79.9L29.2 78.3C28.1 77.8 27.5 76.6 27.5 74.8V36.7C27.5 33.6 29.6 30 32.2 28.7L63.5 12.7C64.6 12.1 65.6 12.1 66.4 12.5L69.6 14.1Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.35042"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M69.6 14.1C70.6 14.6 71.2 15.9 71.2 17.6V55.7C71.2 58.8 69.1 62.4 66.6 63.7L35.3 79.7C34.1 80.3 33.1 80.3 32.3 79.9C31.3 79.4 30.6 78.1 30.6 76.4V38.3C30.6 35.2 32.7 31.6 35.3 30.3L66.6 14.3C67.7 13.7 68.8 13.7 69.6 14.1Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.35042"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <g clipPath="url(#clip0_965_24918)">
        <path
          d="M54.7 43.8C54.7 40.4 52.2 38.8 49.1 40.3C46 41.8 43.5 45.9 43.5 49.3C43.5 52.8 46 54.3 49.1 52.8C52.2 51.3 54.7 47.3 54.7 43.8ZM56.4 43C56.4 44.9 55.8 46.9 54.9 48.8L59.9 52C60.2 52.2 60.2 52.8 59.9 53.3C59.5 53.9 59 54.1 58.7 53.9L53.6 50.8C52.4 52.5 50.8 53.9 49.1 54.7C45 56.7 41.7 54.7 41.7 50.2C41.7 45.6 45 40.4 49.1 38.4C53.1 36.4 56.4 38.5 56.4 43Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
        />
      </g>
      <defs>
        <clipPath id="clip0_965_24918">
          <rect
            width="24.7162"
            height="24.7162"
            fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
            transform="matrix(0.898794 -0.438371 0 1 40.1748 41.0088)"
          />
        </clipPath>
      </defs>
    </svg>
  );
}
