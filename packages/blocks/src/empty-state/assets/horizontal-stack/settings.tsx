/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ILLUSTRATION_COLOR_TOKEN_MAP } from "../helper";

export type SettingsHorizontalStackIllustrationProps = {
  className?: string;
};

export function SettingsHorizontalStackIllustration({ className }: SettingsHorizontalStackIllustrationProps) {
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
          d="M41.6 2C40.8 1.6 39.8 1.6 38.7 2.2L7.8 17.9C5.3 19.2 3.3 22.8 3.3 25.8V63.4C3.3 65.1 3.9 66.3 4.9 66.8L1.8 65.2C0.8 64.7 0.2 63.5 0.2 61.8V24.3C0.2 21.2 2.2 17.6 4.8 16.4L35.6 0.6C36.7 0.1 37.8 0 38.5 0.5L41.6 2Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.35"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M41.6 2C42.6 2.5 43.3 3.7 43.3 5.5V43C43.3 46.1 41.2 49.6 38.7 50.9L7.8 66.6C6.7 67.2 5.7 67.2 4.9 66.8C3.9 66.3 3.3 65.1 3.3 63.4V25.8C3.3 22.8 5.3 19.2 7.8 17.9L38.7 2.2C39.8 1.6 40.8 1.6 41.6 2Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.35"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <g opacity="0.6">
        <path
          d="M55.1 8C54.3 7.6 53.3 7.6 52.1 8.2L21.3 23.9C18.8 25.2 16.7 28.7 16.7 31.8V69.3C16.7 71 17.3 72.2 18.3 72.8L15.3 71.2C14.3 70.7 13.6 69.5 13.6 67.7V30.2C13.6 27.1 15.7 23.6 18.2 22.3L49.1 6.6C50.2 6 51.2 6 52 6.4L55.1 8Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.35"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M55.1 8C56.1 8.5 56.7 9.7 56.7 11.4V48.9C56.7 52 54.7 55.6 52.1 56.8L21.3 72.6C20.2 73.1 19.1 73.2 18.3 72.8C17.3 72.2 16.7 71 16.7 69.3V31.8C16.7 28.7 18.8 25.2 21.3 23.9L52.1 8.2C53.3 7.6 54.3 7.6 55.1 8Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.35"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <path
        d="M68.5 13.9C67.7 13.5 66.7 13.5 65.6 14.1L34.8 29.8C32.2 31.1 30.2 34.7 30.2 37.7V75.3C30.2 77 30.8 78.2 31.8 78.7L28.7 77.1C27.7 76.6 27.1 75.4 27.1 73.7V36.2C27.1 33.1 29.1 29.5 31.7 28.3L62.5 12.5C63.6 12 64.7 11.9 65.5 12.3L68.5 13.9Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M68.5 13.9C69.5 14.4 70.2 15.6 70.2 17.4V54.9C70.2 58 68.1 61.5 65.6 62.8L34.8 78.5C33.6 79.1 32.6 79.1 31.8 78.7C30.8 78.2 30.2 77 30.2 75.3V37.7C30.2 34.7 32.2 31.1 34.8 29.8L65.6 14.1C66.7 13.5 67.7 13.5 68.5 13.9Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M50.4 61.5C50.3 61.5 50.2 61.6 50.1 61.6C48.6 62.2 47.4 61.4 47.2 59.5C47.2 59.1 47 58.8 46.8 58.7C46.5 58.6 46.2 58.6 45.8 58.8C45.7 58.9 45.5 59 45.4 59.2C43.7 60.9 41.8 61 41.1 59.4C40.4 58 40.9 55.8 42.1 54.1C42.4 53.7 42.6 53.2 42.7 52.7C42.7 52.3 42.7 51.9 42.5 51.7C42.4 51.6 42.3 51.5 42.2 51.5C41.4 51.2 41 50.5 40.8 49.6C40.7 48.6 40.9 47.4 41.4 46.3C42.3 44.4 44 43 45.4 43C46 43.1 46.8 42.3 47.1 41.4C47.2 41.2 47.2 41 47.2 40.8C47.2 40.8 47.2 40.7 47.2 40.7C47.3 39.6 47.7 38.5 48.4 37.5C49 36.5 49.9 35.8 50.7 35.4C52.3 34.8 53.5 35.7 53.7 37.5C53.7 37.9 53.9 38.2 54.1 38.3C54.4 38.5 54.7 38.4 55.1 38.2C55.2 38.1 55.4 38 55.5 37.9C57.1 36.1 59.1 36 59.8 37.6C60.4 39 60 41.3 58.7 43C58.1 43.8 58 44.9 58.4 45.4C58.5 45.5 58.6 45.6 58.7 45.6C59.4 45.9 59.9 46.5 60 47.5C60.2 48.5 60 49.6 59.5 50.7C58.6 52.7 56.9 54.1 55.5 54C55.2 54 54.8 54.2 54.5 54.5C54.2 54.8 53.9 55.2 53.8 55.7C53.7 55.9 53.7 56.1 53.7 56.3C53.6 57.4 53.2 58.5 52.5 59.5C51.9 60.4 51.2 61.1 50.5 61.5L50.4 61.5ZM45.9 56.4C46.7 56 47.4 56 48 56.3C48.7 56.6 49.1 57.3 49.1 58.4C49.2 59.1 49.7 59.4 50.3 59.2C50.7 59.1 51 58.7 51.3 58.3C51.5 57.9 51.7 57.5 51.7 57C51.8 56.6 51.9 56.1 52 55.6C52.4 54.4 53 53.4 53.8 52.6C54.7 51.8 55.5 51.4 56.3 51.5C56.9 51.5 57.5 50.9 57.9 50.2C58.1 49.7 58.2 49.2 58.1 48.9C58.1 48.5 57.9 48.2 57.6 48.1C57.3 48 57 47.8 56.8 47.5C55.8 46.3 56.1 43.6 57.6 41.7C58.1 41 58.3 40.1 58 39.5C57.7 38.9 57 38.9 56.3 39.6C56 40 55.6 40.3 55.2 40.5C54.4 41 53.5 41.1 52.9 40.8C52.2 40.5 51.8 39.7 51.7 38.7C51.7 38 51.2 37.7 50.6 37.9C49.8 38.2 49.2 39.1 49.1 40.1C49.1 40.1 49.1 40.1 49.1 40.1C49.1 40.6 49 41 48.9 41.5C48.1 43.9 46.2 45.7 44.6 45.6C44 45.6 43.3 46.1 43 46.9C42.8 47.4 42.7 47.8 42.7 48.2C42.8 48.6 43 48.9 43.3 49C43.6 49.1 43.8 49.3 44 49.5C44.5 50.1 44.7 51.1 44.6 52.2C44.4 53.3 44 54.5 43.3 55.4C42.8 56.1 42.6 57 42.8 57.6C43.1 58.2 43.9 58.2 44.6 57.5C44.9 57.1 45.3 56.8 45.6 56.6C45.7 56.5 45.8 56.5 45.9 56.4V56.4Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        d="M50.4 53.3C48.3 54.3 46.6 53.1 46.6 50.5C46.6 47.9 48.3 44.9 50.4 43.8C52.6 42.7 54.3 44 54.3 46.6C54.3 49.2 52.6 52.2 50.4 53.3ZM50.4 46.2C49.4 46.7 48.5 48.2 48.5 49.5C48.5 50.8 49.4 51.4 50.4 50.9C51.5 50.3 52.4 48.8 52.4 47.6C52.4 46.3 51.5 45.6 50.4 46.2Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
    </svg>
  );
}
