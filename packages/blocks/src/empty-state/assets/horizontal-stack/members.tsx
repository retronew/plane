/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ILLUSTRATION_COLOR_TOKEN_MAP } from "../helper";

export type MembersHorizontalStackIllustrationProps = {
  className?: string;
};

export function MembersHorizontalStackIllustration({ className }: MembersHorizontalStackIllustrationProps) {
  return (
    <svg
      width="71"
      height="80"
      viewBox="0 0 71 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <g opacity="0.2">
        <path
          d="M41.6 2C40.8 1.6 39.8 1.6 38.7 2.2L7.8 17.9C5.3 19.2 3.2 22.7 3.2 25.8V63.3C3.2 65.1 3.9 66.3 4.9 66.8L1.8 65.2C0.8 64.7 0.1 63.5 0.1 61.8V24.3C0.1 21.2 2.2 17.6 4.7 16.3L35.6 0.6C36.7 0 37.7 0 38.5 0.4L41.6 2Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M41.6 2C42.6 2.5 43.2 3.7 43.2 5.4V43C43.2 46 41.2 49.6 38.6 50.9L7.8 66.6C6.7 67.2 5.7 67.2 4.9 66.8C3.9 66.3 3.2 65.1 3.2 63.3V25.8C3.2 22.7 5.3 19.2 7.8 17.9L38.7 2.2C39.8 1.6 40.8 1.6 41.6 2Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <g opacity="0.6">
        <path
          d="M55.1 8C54.3 7.6 53.2 7.6 52.1 8.2L21.3 23.9C18.7 25.2 16.7 28.7 16.7 31.8V69.3C16.7 71 17.3 72.2 18.3 72.8L15.2 71.2C14.2 70.7 13.6 69.5 13.6 67.8V30.2C13.6 27.1 15.7 23.6 18.2 22.3L49 6.6C50.2 6 51.2 6 52 6.4L55.1 8Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M55.1 8C56.1 8.5 56.7 9.7 56.7 11.4V48.9C56.7 52 54.6 55.6 52.1 56.9L21.3 72.6C20.1 73.1 19.1 73.2 18.3 72.8C17.3 72.3 16.7 71 16.7 69.3V31.8C16.7 28.7 18.7 25.2 21.3 23.9L52.1 8.2C53.2 7.6 54.3 7.6 55.1 8Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <path
        d="M68.5 13.9C67.7 13.5 66.7 13.6 65.6 14.1L34.7 29.8C32.2 31.1 30.1 34.7 30.1 37.7V75.3C30.1 77 30.8 78.2 31.8 78.7L28.7 77.1C27.7 76.6 27.1 75.4 27.1 73.7V36.2C27.1 33.1 29.1 29.6 31.7 28.3L62.5 12.5C63.6 12 64.6 11.9 65.4 12.4L68.5 13.9Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M68.5 13.9C69.5 14.4 70.2 15.6 70.2 17.4V54.9C70.2 58 68.1 61.5 65.6 62.8L34.7 78.5C33.6 79.1 32.6 79.1 31.8 78.7C30.8 78.2 30.1 77 30.1 75.3V37.7C30.1 34.7 32.2 31.1 34.7 29.8L65.6 14.1C66.7 13.5 67.7 13.5 68.5 13.9Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M47.3 51.7C48.5 49.6 50.2 47.8 52 46.9C53.8 46 55.5 46 56.8 46.9C58 47.8 58.8 49.5 58.8 51.7C58.8 52.3 58.3 53.1 57.8 53.3C57.3 53.6 56.8 53.3 56.8 52.7C56.8 51.1 56.3 49.9 55.4 49.2C54.5 48.6 53.3 48.6 52 49.3C50.7 49.9 49.5 51.1 48.6 52.7C47.7 54.3 47.2 56 47.2 57.6C47.2 58.2 46.8 59 46.2 59.2C45.7 59.5 45.3 59.2 45.3 58.5C45.3 56.4 46 53.9 47.3 51.7V51.7Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M52 39.9C50.4 40.7 49.1 42.9 49.1 44.9C49.1 46.8 50.4 47.7 52 46.9C53.6 46.1 54.9 43.9 54.9 41.9C54.9 40 53.6 39.1 52 39.9ZM47.2 45.9C47.2 42.6 49.4 38.9 52 37.5C54.7 36.2 56.8 37.7 56.8 40.9C56.8 44.2 54.7 47.9 52 49.3C49.4 50.6 47.2 49.1 47.2 45.9Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M56.8 37.4C56.8 36.8 57.3 36 57.8 35.8C58.9 35.2 60 35.2 60.8 35.8C61.5 36.4 62 37.5 62 38.8C62 40.2 61.5 41.7 60.8 43.1C60.7 43.2 60.7 43.2 60.7 43.3C61.1 43.4 61.5 43.5 61.9 43.8C63 44.6 63.6 46.1 63.6 48C63.6 48.7 63.2 49.4 62.6 49.7C62.1 50 61.7 49.7 61.7 49C61.7 47.7 61.3 46.7 60.5 46.2C59.8 45.6 58.8 45.6 57.8 46.1C57.3 46.4 56.8 46.1 56.8 45.4C56.8 44.8 57.3 44.1 57.8 43.8C58.4 43.5 59 42.9 59.4 42.2C59.8 41.4 60.1 40.6 60.1 39.8C60.1 39 59.8 38.4 59.4 38.1C59 37.8 58.4 37.8 57.8 38.1C57.3 38.4 56.8 38.1 56.8 37.4L56.8 37.4Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M47.2 42.3C47.2 41.7 46.8 41.4 46.2 41.7C45.1 42.2 44.1 43.3 43.3 44.7C42.5 46.1 42.1 47.6 42.1 49C42.1 50.3 42.5 51.4 43.3 52C43.3 52 43.4 52.1 43.4 52.1C42.9 52.6 42.5 53.2 42.1 53.9C41.1 55.8 40.5 57.9 40.5 59.8C40.5 60.5 40.9 60.8 41.4 60.5C42 60.2 42.4 59.5 42.4 58.9C42.4 57.6 42.8 56.1 43.5 54.8C44.2 53.6 45.2 52.5 46.2 52C46.8 51.8 47.2 51 47.2 50.4C47.2 49.7 46.8 49.4 46.2 49.7C45.6 50 45.1 50 44.7 49.7C44.2 49.4 44 48.8 44 48C44 47.2 44.2 46.4 44.7 45.6C45.1 44.9 45.6 44.3 46.2 44C46.8 43.7 47.2 43 47.2 42.3L47.2 42.3Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
    </svg>
  );
}
