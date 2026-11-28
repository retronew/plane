/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ILLUSTRATION_COLOR_TOKEN_MAP } from "../helper";

export type ExportHorizontalStackIllustrationProps = {
  className?: string;
};

export function ExportHorizontalStackIllustration({ className }: ExportHorizontalStackIllustrationProps) {
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
          d="M41.7 2C40.9 1.6 39.8 1.7 38.7 2.2L7.9 17.9C5.3 19.2 3.3 22.8 3.3 25.9V63.4C3.3 65.1 3.9 66.3 4.9 66.8L1.8 65.3C0.8 64.8 0.2 63.5 0.2 61.8V24.3C0.2 21.2 2.3 17.7 4.8 16.4L35.6 0.7C36.8 0.1 37.8 0.1 38.6 0.5L41.7 2Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M41.7 2C42.7 2.6 43.3 3.8 43.3 5.5V43C43.3 46.1 41.2 49.6 38.7 50.9L7.9 66.6C6.7 67.2 5.7 67.2 4.9 66.8C3.9 66.3 3.3 65.1 3.3 63.4V25.9C3.3 22.8 5.3 19.2 7.9 18L38.7 2.2C39.8 1.7 40.9 1.6 41.7 2Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <g opacity="0.6">
        <path
          d="M55.1 8C54.3 7.6 53.3 7.6 52.2 8.2L21.3 23.9C18.8 25.2 16.7 28.7 16.7 31.8V69.3C16.7 71.1 17.4 72.3 18.4 72.8L15.3 71.2C14.3 70.7 13.7 69.5 13.7 67.8V30.2C13.7 27.2 15.7 23.6 18.2 22.3L49.1 6.6C50.2 6 51.2 6 52 6.4L55.1 8Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M55.1 8C56.1 8.5 56.7 9.7 56.7 11.4V49C56.7 52 54.7 55.6 52.2 56.9L21.3 72.6C20.2 73.2 19.2 73.2 18.4 72.8C17.4 72.3 16.7 71.1 16.7 69.3V31.8C16.7 28.7 18.8 25.2 21.3 23.9L52.2 8.2C53.3 7.6 54.3 7.6 55.1 8Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <path
        d="M68.6 13.9C67.8 13.5 66.7 13.6 65.6 14.1L34.8 29.8C32.2 31.1 30.2 34.7 30.2 37.8V75.3C30.2 77 30.8 78.2 31.8 78.7L28.7 77.2C27.7 76.6 27.1 75.4 27.1 73.7V36.2C27.1 33.1 29.2 29.6 31.7 28.3L62.5 12.6C63.7 12 64.7 12 65.5 12.4L68.6 13.9Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M68.6 13.9C69.6 14.4 70.2 15.7 70.2 17.4V54.9C70.2 58 68.1 61.5 65.6 62.8L34.8 78.5C33.6 79.1 32.6 79.1 31.8 78.7C30.8 78.2 30.2 77 30.2 75.3V37.8C30.2 34.7 32.2 31.1 34.8 29.8L65.6 14.1C66.7 13.6 67.8 13.5 68.6 13.9Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M43.3 40.2C43.3 39.5 43.7 38.7 44.3 38.4L58.6 31.1C59.2 30.8 59.7 31.2 59.7 31.9C59.7 32.6 59.2 33.3 58.6 33.6L44.3 40.9C43.7 41.2 43.3 40.9 43.3 40.2Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M58.3 45.9C57.9 46.6 57.3 46.9 56.9 46.6L52.5 43.5V57.9C52.5 58.6 52 59.4 51.5 59.7C50.9 60 50.5 59.6 50.5 59V44.5L46.1 52.1C45.7 52.8 45 53.1 44.6 52.8C44.2 52.6 44.2 51.8 44.6 51.1L50.8 40.5C50.8 40.5 50.8 40.4 50.8 40.4C50.8 40.4 50.8 40.4 50.8 40.4C50.9 40.3 51 40.2 51.1 40.1C51.1 40 51.1 40 51.2 40C51.2 39.9 51.2 39.9 51.3 39.9C51.3 39.9 51.4 39.8 51.4 39.8C51.4 39.8 51.4 39.8 51.5 39.8C51.5 39.7 51.6 39.7 51.6 39.7C51.7 39.7 51.8 39.6 52 39.7C52 39.7 52 39.7 52 39.7C52 39.7 52.1 39.7 52.1 39.7C52.2 39.7 52.2 39.8 52.2 39.8L58.3 44.1C58.7 44.4 58.7 45.2 58.3 45.9L58.3 45.9Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
    </svg>
  );
}
