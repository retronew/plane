/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ILLUSTRATION_COLOR_TOKEN_MAP } from "../helper";

export type WorkflowHorizontalStackIllustrationProps = {
  className?: string;
};

export function WorkflowHorizontalStackIllustration({ className }: WorkflowHorizontalStackIllustrationProps) {
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
      <g clipPath="url(#clip0_338_21239)">
        <path
          d="M57.5 39.8C58.5 39.2 59.4 37.8 59.4 36.6C59.4 35.4 58.5 35 57.5 35.6C56.5 36.1 55.7 37.5 55.7 38.7C55.7 39.9 56.5 40.3 57.5 39.8ZM47 58.1C48 57.5 48.8 56.1 48.8 54.9C48.8 53.8 48 53.3 47 53.9C46 54.5 45.1 55.9 45.1 57C45.1 58.2 46 58.7 47 58.1ZM47 60C45 61.1 43.5 60.2 43.5 58C43.5 55.8 45 53.1 47 52C48.6 51 50 51.5 50.3 53.1L55.8 49.9C56 49.8 56.3 49.5 56.4 49.2C56.6 48.9 56.7 48.6 56.7 48.3L56.7 45.3C56.7 44.7 57.1 44.1 57.5 43.8C58 43.6 58.4 43.8 58.4 44.3L58.4 47.4C58.4 48.2 58.1 49.1 57.6 49.9C57.1 50.8 56.5 51.4 55.8 51.8L50.3 55C50 57 48.6 59 47 60ZM57.5 41.7C55.9 42.6 54.5 42.1 54.2 40.6L44.3 46.2C43.9 46.5 43.5 46.3 43.5 45.8C43.5 45.2 43.9 44.6 44.3 44.3L54.2 38.6C54.5 36.7 55.9 34.6 57.5 33.6C59.5 32.5 61 33.4 61 35.7C61 37.9 59.5 40.6 57.5 41.7Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.70084"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <defs>
        <clipPath id="clip0_338_21239">
          <rect width="22.4269" height="22.4269" fill="white" transform="matrix(0.866025 -0.5 0 1 42.5404 41.209)" />
        </clipPath>
      </defs>
    </svg>
  );
}
