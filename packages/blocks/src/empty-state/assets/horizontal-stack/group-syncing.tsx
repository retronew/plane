/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ILLUSTRATION_COLOR_TOKEN_MAP } from "../helper";

export type GroupSyncingHorizontalStackIllustrationProps = {
  className?: string;
};

export function GroupSyncingHorizontalStackIllustration({ className }: GroupSyncingHorizontalStackIllustrationProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="69"
      height="78"
      viewBox="0 0 69 78"
      fill="none"
      className={className}
    >
      <g opacity="0.2">
        <path
          d="M40.8 2C40 1.6 39 1.6 37.9 2.2L7.7 17.7C5.2 18.9 3.2 22.4 3.2 25.5V62.4C3.2 64.1 3.8 65.3 4.8 65.8L1.8 64.3C0.8 63.8 0.2 62.6 0.2 60.9V23.9C0.2 20.9 2.2 17.4 4.7 16.1L34.9 0.6C36 0.1 37 0 37.8 0.4L40.8 2H40.8Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M40.8 2C41.8 2.5 42.4 3.7 42.4 5.4V42.3C42.4 45.4 40.4 48.9 37.9 50.1L7.7 65.6C6.6 66.2 5.6 66.2 4.8 65.8C3.8 65.3 3.2 64.1 3.2 62.4V25.5C3.2 22.4 5.2 18.9 7.7 17.7L37.9 2.2C39 1.6 40 1.6 40.8 2Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <g opacity="0.6">
        <path
          d="M54 7.9C53.2 7.5 52.2 7.5 51.1 8.1L20.9 23.6C18.4 24.8 16.4 28.3 16.4 31.4V68.3C16.4 70 17 71.2 18 71.7L15 70.2C14 69.7 13.4 68.5 13.4 66.8V29.8C13.4 26.8 15.4 23.3 17.9 22L48.1 6.5C49.2 6 50.2 5.9 51 6.3L54 7.9Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M54 7.9C55 8.4 55.6 9.6 55.6 11.3V48.2C55.6 51.3 53.6 54.8 51.1 56L20.9 71.5C19.8 72.1 18.8 72.1 18 71.7C17 71.2 16.4 70 16.4 68.3V31.4C16.4 28.3 18.4 24.8 20.9 23.6L51.1 8.1C52.2 7.5 53.2 7.5 54 7.9Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <path
        d="M67.2 13.7C66.4 13.3 65.4 13.4 64.3 13.9L34.1 29.4C31.6 30.7 29.6 34.2 29.6 37.2V74.2C29.6 75.9 30.2 77.1 31.2 77.6L28.2 76C27.2 75.5 26.6 74.3 26.6 72.6V35.7C26.6 32.6 28.6 29.1 31.1 27.9L61.3 12.4C62.4 11.8 63.4 11.8 64.2 12.2L67.2 13.7Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M67.2 13.7C68.2 14.2 68.8 15.4 68.8 17.1V54.1C68.8 57.1 66.8 60.6 64.3 61.9L34.1 77.4C33 77.9 32 78 31.2 77.6C30.2 77.1 29.6 75.9 29.6 74.2V37.2C29.6 34.2 31.6 30.7 34.1 29.4L64.3 13.9C65.4 13.4 66.4 13.3 67.2 13.7Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M59.8 49.4C60 48.7 60.5 48.2 61 48.1C61.4 48.1 61.7 48.6 61.5 49.2C61.1 50.8 60.4 52.4 59.2 53.8C57.2 56.3 54.7 57.1 53.1 56C52.9 56.3 52.6 56.6 52.3 56.7C51.8 56.8 51.5 56.3 51.6 55.7L52 53.9L52.1 53.6C52.1 53.4 52.3 53.2 52.4 53C52.6 52.8 52.8 52.6 53.1 52.5L54.4 52.3C54.9 52.2 55.2 52.7 55 53.3C55 53.5 54.9 53.8 54.7 54C55.8 54.4 57.2 53.8 58.4 52.4C59.1 51.5 59.6 50.4 59.8 49.4V49.4ZM40.9 61.2C40.9 60.2 40.9 59.4 40.9 58.7C40.9 57.9 41 57.3 41.2 56.6C41.7 55 42.6 53.4 43.7 52.3C44.2 51.8 44.7 51.5 45.2 51.1C45.8 50.8 46.5 50.4 47.3 50L50.4 48.4C50.9 48.2 51.3 48.5 51.3 49.1C51.3 49.7 50.9 50.3 50.4 50.6L47.3 52.1C46.5 52.6 45.8 52.9 45.4 53.2C44.9 53.5 44.6 53.7 44.4 53.9C43.7 54.6 43.1 55.6 42.8 56.6C42.7 56.9 42.7 57.3 42.6 57.9C42.6 58.5 42.6 59.3 42.6 60.4C42.6 61.4 42.2 61.6 41.7 61.9C41.3 62.1 40.9 61.8 40.9 61.2L40.9 61.2ZM54.1 45.6C56.2 43.2 58.7 42.4 60.3 43.5C60.5 43.1 60.8 42.8 61.1 42.7C61.6 42.7 61.9 43.1 61.7 43.7L61.4 45.6C61.3 45.9 61.2 46.2 61 46.4C60.8 46.7 60.5 46.8 60.3 46.9L59 47.1C58.5 47.2 58.2 46.8 58.3 46.1C58.4 45.9 58.5 45.6 58.6 45.4C57.6 45 56.2 45.6 55 47C54.3 47.9 53.9 48.9 53.6 49.8C53.4 50.5 52.9 51 52.5 51C52 51 51.8 50.5 52 49.9C52.4 48.4 53.1 46.9 54.2 45.6H54.1ZM51.6 39.8C51.6 37.8 50.3 36.9 48.7 37.7C47.2 38.5 45.9 40.8 45.9 42.7C45.9 44.6 47.2 45.5 48.7 44.7C50.3 43.9 51.6 41.7 51.6 39.8ZM55.8 37.6C55.8 36.1 55.1 35.2 54 35.3C53.6 35.3 53.4 34.8 53.5 34.1C53.7 33.5 54.2 32.9 54.7 32.9C56.4 32.9 57.6 34.3 57.6 36.7C57.6 39.1 56.4 41.7 54.7 43.4C54.2 43.8 53.7 43.8 53.5 43.4C53.4 42.9 53.6 42.2 54 41.8C55.1 40.7 55.8 39.1 55.8 37.6V37.6ZM53.4 38.9C53.4 42 51.3 45.6 48.7 46.9C46.2 48.2 44.1 46.7 44.1 43.6C44.1 40.5 46.2 36.9 48.7 35.6C51.3 34.3 53.4 35.7 53.4 38.9Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
    </svg>
  );
}
