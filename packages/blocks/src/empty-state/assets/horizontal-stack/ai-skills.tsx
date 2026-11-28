/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ILLUSTRATION_COLOR_TOKEN_MAP } from "../helper";

export type AiSkillsHorizontalStackIllustrationProps = {
  className?: string;
};

export function AiSkillsHorizontalStackIllustration({ className }: AiSkillsHorizontalStackIllustrationProps) {
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
      <g clipPath="url(#clip0_4973_22070)">
        <path
          d="M56 45.7C56 42.8 53.9 41.5 51.3 42.7C48.7 44 46.6 47.4 46.6 50.2C46.6 52 47.4 53.1 48.5 53.5C48.8 53.6 48.9 53.8 48.9 54.1V56.1C48.9 56.7 48.9 57.1 48.9 57.4C49 57.6 49 57.7 49 57.8C49.1 57.9 49.3 58 49.4 58.1C49.5 58.1 49.6 58.1 49.9 58C50.1 57.8 50.5 57.7 51 57.4L51.6 57.1C52.1 56.9 52.4 56.7 52.7 56.6C53 56.4 53.1 56.3 53.1 56.3L53.2 56.1C53.4 56 53.5 55.8 53.5 55.6C53.6 55.5 53.6 55.4 53.6 55.1C53.7 54.8 53.7 54.4 53.7 53.8V51.8C53.7 51.5 53.8 51.1 54 50.9C55.2 49.3 56 47.4 56 45.7ZM50.4 55.1V50.9L49.4 51.4C49 51.6 48.6 51.4 48.6 50.8C48.6 50.3 49 49.7 49.4 49.4L53.1 47.6C53.6 47.4 54 47.6 54 48.2C54 48.7 53.6 49.3 53.1 49.6L52.2 50V54.2C52.2 54.8 51.8 55.4 51.3 55.6C50.8 55.8 50.4 55.6 50.4 55.1ZM43 51C43.4 50.8 43.8 51.1 43.8 51.6C43.8 52.1 43.4 52.7 43 53L42 53.4C41.5 53.7 41.2 53.4 41.2 52.9C41.2 52.4 41.5 51.7 42 51.5L43 51ZM60.5 42.5C61 42.2 61.4 42.5 61.4 43C61.4 43.5 61 44.2 60.5 44.4L59.6 44.9C59.1 45.1 58.7 44.8 58.7 44.3C58.7 43.8 59.1 43.2 59.6 42.9L60.5 42.5ZM44.1 43.5C44.4 42.9 45 42.6 45.3 42.9L45.9 43.2C46.2 43.4 46.2 44 45.9 44.6C45.5 45.1 45 45.4 44.7 45.2L44.1 44.8C43.8 44.6 43.8 44 44.1 43.5ZM57.2 37C57.6 36.5 58.1 36.2 58.5 36.4C58.8 36.7 58.8 37.3 58.5 37.8L57.9 38.7C57.6 39.2 57 39.5 56.7 39.3C56.3 39.1 56.3 38.5 56.7 37.9L57.2 37ZM50.4 39.1V38.1C50.4 37.5 50.8 36.9 51.3 36.7C51.8 36.5 52.2 36.7 52.2 37.2V38.3C52.2 38.8 51.8 39.4 51.3 39.6C50.8 39.9 50.4 39.6 50.4 39.1ZM57.7 44.8C57.7 47 56.8 49.4 55.4 51.4V52.9C55.4 53.5 55.4 54 55.4 54.4C55.3 54.8 55.3 55.2 55.1 55.7C54.8 56.4 54.4 57.1 53.9 57.6C53.6 58 53.2 58.2 52.8 58.4C52.5 58.6 52.1 58.8 51.6 59.1L51 59.3C50.5 59.6 50.1 59.8 49.7 59.9C49.4 60.1 49 60.2 48.7 60.2C48.1 60.1 47.7 59.9 47.5 59.4C47.3 59.1 47.2 58.8 47.2 58.4C47.2 58 47.2 57.5 47.2 57V55.4C45.8 54.8 44.9 53.3 44.9 51.1C44.9 47.1 47.7 42.5 51.3 40.8C54.8 39.1 57.7 40.9 57.7 44.8Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        />
      </g>
      <defs>
        <clipPath id="clip0_4973_22070">
          <rect
            width="24.7162"
            height="24.7162"
            fill="white"
            transform="matrix(0.898794 -0.438371 0 1 40.1753 41.0103)"
          />
        </clipPath>
      </defs>
    </svg>
  );
}
