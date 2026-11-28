/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ILLUSTRATION_COLOR_TOKEN_MAP } from "../helper";

export type ProjectHorizontalStackIllustrationProps = {
  className?: string;
};

export function ProjectHorizontalStackIllustration({ className }: ProjectHorizontalStackIllustrationProps) {
  return (
    <svg
      width="102"
      height="115"
      viewBox="0 0 102 115"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <g opacity="0.2">
        <path
          d="M60.3 2.9C59.1 2.3 57.6 2.4 56 3.2L11.4 26C7.7 27.8 4.7 33 4.7 37.4V91.8C4.7 94.3 5.6 96 7.1 96.8L2.6 94.5C1.2 93.8 0.2 92 0.2 89.5V35.2C0.2 30.7 3.2 25.6 6.9 23.7L51.6 0.9C53.2 0.1 54.7 0.1 55.8 0.6L60.3 2.9H60.3Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M60.3 2.9C61.7 3.7 62.7 5.4 62.7 7.9V62.3C62.7 66.7 59.7 71.9 56 73.7L11.3 96.5C9.7 97.3 8.2 97.4 7.1 96.8C5.6 96 4.7 94.3 4.7 91.8V37.4C4.7 33 7.7 27.8 11.4 26L56 3.2C57.6 2.4 59.1 2.3 60.3 2.9Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <g opacity="0.6">
        <path
          d="M79.8 11.6C78.6 11 77.1 11 75.5 11.9L30.8 34.6C27.2 36.5 24.2 41.6 24.2 46.1V100.4C24.2 102.9 25.1 104.7 26.6 105.4L22.1 103.2C20.7 102.4 19.7 100.7 19.7 98.2V43.8C19.7 39.4 22.7 34.2 26.4 32.4L71 9.6C72.7 8.8 74.2 8.7 75.3 9.3L79.8 11.6Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M79.8 11.6C81.2 12.3 82.1 14.1 82.1 16.6V70.9C82.1 75.4 79.2 80.5 75.5 82.4L30.8 105.2C29.2 106 27.7 106 26.6 105.4C25.1 104.7 24.2 102.9 24.2 100.4V46.1C24.2 41.6 27.2 36.5 30.8 34.6L75.5 11.9C77.1 11 78.6 11 79.8 11.6Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <path
        d="M99.3 20.2C98.1 19.6 96.6 19.7 95 20.5L50.3 43.2C46.7 45.1 43.7 50.2 43.7 54.7V109.1C43.7 111.5 44.6 113.3 46.1 114L41.6 111.8C40.1 111 39.2 109.3 39.2 106.8V52.4C39.2 48 42.2 42.8 45.9 41L90.5 18.2C92.2 17.4 93.7 17.3 94.8 17.9L99.3 20.2Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M99.3 20.2C100.7 20.9 101.6 22.7 101.6 25.2V79.5C101.6 84 98.7 89.1 95 91L50.3 113.8C48.7 114.6 47.2 114.6 46.1 114C44.6 113.3 43.7 111.5 43.7 109.1V54.7C43.7 50.2 46.7 45.1 50.3 43.2L95 20.5C96.6 19.6 98.1 19.6 99.3 20.2Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M85.9 51.3L82 53.3V51.7C82 49.1 80.2 47.8 78 49L72.8 51.6C70.6 52.7 68.9 55.8 68.9 58.4V60L64.9 62C62.8 63.1 61 66.2 61 68.8V84.8C61 87.4 62.8 88.7 64.9 87.5L85.9 76.9C88.1 75.7 89.8 72.7 89.8 70.1V54.1C89.8 51.5 88.1 50.2 85.9 51.3L85.9 51.3ZM71.5 57.1C71.5 56.2 72.1 55.2 72.8 54.8L78 52.2C78.7 51.8 79.3 52.2 79.3 53.1V54.7L71.5 58.7V57.1V57.1ZM79.3 57.9V77L71.5 81V61.9L79.3 57.9ZM63.6 83.4V67.5C63.6 66.6 64.2 65.6 64.9 65.2L68.8 63.2V82.4L64.9 84.4C64.2 84.7 63.6 84.3 63.6 83.4ZM87.2 71.4C87.2 72.3 86.6 73.3 85.9 73.7L82 75.7V56.5L85.9 54.5C86.6 54.1 87.2 54.6 87.2 55.4V71.4Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
    </svg>
  );
}
