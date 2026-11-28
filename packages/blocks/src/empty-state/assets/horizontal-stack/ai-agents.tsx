/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ILLUSTRATION_COLOR_TOKEN_MAP } from "../helper";

export type AiAgentsHorizontalStackIllustrationProps = {
  className?: string;
};

export function AiAgentsHorizontalStackIllustration({ className }: AiAgentsHorizontalStackIllustrationProps) {
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
          d="M55.9 8.1C55.1 7.7 54.1 7.7 52.9 8.3L21.6 24.2C19.1 25.5 17 29.1 17 32.3V70.4C17 72.1 17.6 73.3 18.6 73.9L15.5 72.3C14.5 71.7 13.8 70.5 13.8 68.8V30.7C13.8 27.5 15.9 23.9 18.5 22.6L49.8 6.7C50.9 6.1 52 6.1 52.8 6.5L55.9 8.1Z"
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
      <path
        d="M58.7 40C58.7 39.1 58.7 38.5 58.7 38.1C58.7 37.6 58.6 37.4 58.5 37.3C58.4 37 58.1 36.8 57.7 36.7C57.5 36.7 57.3 36.8 56.9 36.9C56.5 37.1 56 37.4 55.2 37.8L47.4 41.5C46.6 41.9 46.1 42.2 45.6 42.4C45.2 42.7 45 42.8 44.9 43C44.5 43.4 44.2 43.9 44 44.3C43.9 44.6 43.9 44.8 43.9 45.3C43.8 45.8 43.8 46.4 43.8 47.3V55.9C43.8 56.8 43.8 57.4 43.9 57.8C43.9 58.3 43.9 58.5 44 58.6C44.2 58.9 44.5 59.1 44.9 59.2C45 59.2 45.2 59.1 45.6 59C46.1 58.8 46.6 58.5 47.4 58.1L55.2 54.4C56 54 56.5 53.7 56.9 53.5C57.3 53.2 57.5 53.1 57.7 52.9C58.1 52.5 58.4 52 58.5 51.6C58.6 51.3 58.7 51.1 58.7 50.6C58.7 50.1 58.7 49.5 58.7 48.6V40ZM60.5 47.8C60.5 48.6 60.5 49.3 60.4 49.9C60.4 50.5 60.3 51.1 60.1 51.7C59.7 52.6 59.2 53.5 58.5 54.2C58.1 54.7 57.6 55 57.1 55.3C56.6 55.6 55.9 55.9 55.2 56.3L47.4 60.1C46.6 60.5 46 60.8 45.5 61C45 61.2 44.5 61.3 44.1 61.3C43.4 61.2 42.8 60.9 42.5 60.3C42.3 59.9 42.2 59.4 42.1 58.8C42.1 58.3 42.1 57.6 42.1 56.8V48.1C42.1 47.3 42.1 46.6 42.1 46C42.2 45.4 42.3 44.8 42.5 44.2C42.8 43.3 43.4 42.4 44.1 41.7C44.5 41.2 45 40.9 45.5 40.6C46 40.3 46.6 40 47.4 39.6L55.2 35.8C55.9 35.4 56.6 35.1 57.1 34.9C57.6 34.7 58.1 34.6 58.5 34.6C59.2 34.7 59.7 35 60.1 35.6C60.3 36 60.4 36.5 60.4 37.1C60.5 37.6 60.5 38.3 60.5 39.1V47.8Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
      />
      <path
        d="M45.7 49.6V48.1C45.7 47.2 46.4 46.2 47.1 45.9C47.9 45.5 48.5 45.9 48.5 46.7V48.3C48.5 49.1 47.9 50.1 47.1 50.5C46.4 50.9 45.7 50.5 45.7 49.6ZM54.1 45.6V44C54.1 43.2 54.7 42.2 55.4 41.8C56.2 41.4 56.8 41.8 56.8 42.7V44.2C56.8 45.1 56.2 46.1 55.4 46.4C54.7 46.8 54.1 46.4 54.1 45.6Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
      />
    </svg>
  );
}
