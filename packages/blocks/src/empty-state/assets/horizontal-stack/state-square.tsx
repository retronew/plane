/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ILLUSTRATION_COLOR_TOKEN_MAP } from "../helper";

export type StateSquareHorizontalStackIllustrationProps = {
  className?: string;
};

export function StateSquareHorizontalStackIllustration({ className }: StateSquareHorizontalStackIllustrationProps) {
  return (
    <svg
      width="70"
      height="79"
      viewBox="0 0 70 79"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <g opacity="0.2">
        <path
          d="M41.4 2C40.6 1.6 39.6 1.6 38.5 2.2L7.8 17.8C5.3 19.1 3.2 22.7 3.2 25.7V63.1C3.2 64.8 3.9 66 4.9 66.5L1.8 64.9C0.8 64.4 0.2 63.2 0.2 61.5V24.2C0.2 21.1 2.2 17.6 4.7 16.3L35.4 0.6C36.5 0.1 37.6 0 38.4 0.4L41.4 2H41.4Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M41.4 2C42.4 2.5 43 3.7 43 5.4V42.8C43 45.8 41 49.4 38.5 50.7L7.8 66.3C6.7 66.9 5.6 66.9 4.9 66.5C3.9 66 3.2 64.8 3.2 63.1V25.7C3.2 22.6 5.3 19.1 7.8 17.8L38.5 2.2C39.6 1.6 40.6 1.6 41.4 2Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <g opacity="0.6">
        <path
          d="M54.8 8C54 7.6 53 7.6 51.9 8.2L21.2 23.8C18.7 25.1 16.6 28.6 16.6 31.7V69C16.6 70.7 17.3 71.9 18.2 72.4L15.2 70.9C14.2 70.4 13.6 69.2 13.6 67.5V30.1C13.6 27 15.6 23.5 18.1 22.2L48.8 6.6C49.9 6 51 6 51.7 6.4L54.8 8Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M54.8 8C55.8 8.5 56.4 9.7 56.4 11.4V48.7C56.4 51.8 54.4 55.3 51.9 56.6L21.2 72.3C20.1 72.8 19 72.9 18.2 72.4C17.3 71.9 16.6 70.7 16.6 69V31.7C16.6 28.6 18.7 25.1 21.2 23.8L51.9 8.2C53 7.6 54 7.6 54.8 8Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <path
        d="M68.2 13.9C67.4 13.5 66.4 13.5 65.3 14.1L34.6 29.7C32.1 31 30 34.5 30 37.6V74.9C30 76.6 30.6 77.8 31.6 78.4L28.6 76.8C27.6 76.3 26.9 75.1 26.9 73.4V36C26.9 33 29 29.4 31.5 28.1L62.2 12.5C63.3 11.9 64.3 11.9 65.1 12.3L68.2 13.9Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M68.2 13.9C69.2 14.4 69.8 15.6 69.8 17.3V54.7C69.8 57.7 67.8 61.2 65.3 62.5L34.6 78.2C33.5 78.7 32.4 78.8 31.6 78.4C30.6 77.9 30 76.6 30 74.9V37.6C30 34.5 32.1 31 34.6 29.7L65.3 14.1C66.4 13.5 67.4 13.5 68.2 13.9Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <g clipPath="url(#clip0_115_13471)">
        <path
          d="M42.3 59.2V54.1L42.5 54C43.5 53.5 44.2 54 44.2 55.2V58C44.2 58.4 44.5 58.6 44.9 58.4V60.7L44.6 60.8C43.4 61.4 42.4 60.8 42.3 59.4L42.3 59.2ZM47.3 57V59.2L44.9 60.7V58.4L47.3 57ZM47.3 57C48.4 56.4 49.3 56.9 49.3 58.1L47.3 59.2V57ZM55.5 54.6L53.5 55.7C53.5 54.4 54.4 52.9 55.5 52.3V54.6ZM57.9 50.9V53.2L55.5 54.6V52.3L57.9 50.9ZM60.5 49C60.3 50.4 59.4 52.1 58.2 53L57.9 53.2V50.9C58.2 50.7 58.5 50.2 58.5 49.8V47C58.5 45.7 59.4 44.2 60.5 43.6V48.7L60.5 49ZM42.3 44.2C42.3 42.6 43.3 40.7 44.6 39.8L44.9 39.7L49.3 37.1C49.3 38.3 48.5 39.7 47.5 40.4L47.3 40.5L44.9 41.9C44.5 42.1 44.2 42.6 44.2 43V45.8C44.2 47.1 43.4 48.6 42.3 49.2V44.2ZM60.5 38.7L60.3 38.8C59.3 39.3 58.5 38.8 58.5 37.6V34.8C58.5 34.4 58.2 34.2 57.9 34.4L55.5 35.8C54.4 36.4 53.6 36 53.5 34.9L53.5 34.7L57.9 32.2L58.2 32C59.5 31.4 60.5 32.1 60.5 33.7V38.7Z"
          fill="#909598"
        />
      </g>
      <defs>
        <clipPath id="clip0_115_13471">
          <rect
            width="24"
            height="24"
            fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
            transform="matrix(0.866025 -0.5 0 1 41 40.4009)"
          />
        </clipPath>
      </defs>
    </svg>
  );
}
