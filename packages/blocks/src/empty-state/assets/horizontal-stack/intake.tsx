/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ILLUSTRATION_COLOR_TOKEN_MAP } from "../helper";

export type IntakeHorizontalStackIllustrationProps = {
  className?: string;
};

export function IntakeHorizontalStackIllustration({ className }: IntakeHorizontalStackIllustrationProps) {
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
          d="M55.1 8C54.3 7.6 53.3 7.6 52.2 8.2L21.3 23.9C18.8 25.2 16.7 28.8 16.7 31.8V69.4C16.7 71.1 17.4 72.3 18.4 72.8L15.3 71.2C14.3 70.7 13.7 69.5 13.7 67.8V30.3C13.7 27.2 15.7 23.7 18.2 22.4L49.1 6.6C50.2 6.1 51.2 6 52 6.5L55.1 8Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M55.1 8C56.1 8.5 56.7 9.7 56.7 11.5V49C56.7 52.1 54.7 55.6 52.2 56.9L21.3 72.6C20.2 73.2 19.2 73.2 18.4 72.8C17.4 72.3 16.7 71.1 16.7 69.4V31.8C16.7 28.8 18.8 25.2 21.3 23.9L52.2 8.2C53.3 7.6 54.3 7.6 55.1 8Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <path
        d="M68.6 14C67.8 13.6 66.7 13.6 65.6 14.2L34.8 29.9C32.2 31.2 30.2 34.7 30.2 37.8V75.3C30.2 77 30.8 78.2 31.8 78.8L28.7 77.2C27.7 76.7 27.1 75.5 27.1 73.8V36.2C27.1 33.1 29.2 29.6 31.7 28.3L62.5 12.6C63.7 12 64.7 12 65.5 12.4L68.6 14Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M68.6 14C69.6 14.5 70.2 15.7 70.2 17.4V54.9C70.2 58 68.1 61.6 65.6 62.9L34.8 78.6C33.6 79.1 32.6 79.2 31.8 78.8C30.8 78.3 30.2 77 30.2 75.3V37.8C30.2 34.7 32.2 31.2 34.8 29.9L65.6 14.2C66.7 13.6 67.8 13.6 68.6 14Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M57.6 34.9C57.8 35 58 35.3 58 35.7V46.1C58 46.5 57.8 46.9 57.6 47.3L51.9 54.4C51.6 54.8 51.2 55 51 54.9C50.7 54.9 50.5 54.6 50.5 54.2V43.7C50.5 43.3 50.7 42.9 51 42.5L56.7 35.4C56.9 35 57.3 34.9 57.6 34.9H57.6ZM52.3 43.4V51.3L56.2 46.3V38.6L52.3 43.4Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M55 34.5C55.3 34.9 55.1 35.7 54.7 36.2L49.4 42.8V52.6C49.4 53.2 49 53.9 48.5 54.2C48 54.4 47.6 54.1 47.6 53.5V43.1C47.6 42.7 47.8 42.2 48.1 41.9L53.8 34.7C54.2 34.2 54.8 34.1 55 34.5Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M52.1 33.8C52.4 34.2 52.2 35 51.8 35.5L46.5 42.1V51.9C46.5 52.5 46.1 53.2 45.6 53.5C45.1 53.7 44.7 53.4 44.7 52.8V42.4C44.7 42 44.9 41.5 45.2 41.2L50.9 34C51.3 33.5 51.9 33.4 52.1 33.8Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M41.7 51.8C42.2 51.5 42.6 51.8 42.6 52.4V60.4C42.6 61.2 43.1 61.6 43.7 61.3L58.9 53.5C59.5 53.2 60 52.3 60 51.6V43.6C60 43 60.4 42.2 60.9 42C61.4 41.7 61.8 42 61.8 42.7V50.7C61.8 52.7 60.5 54.9 58.9 55.8L43.7 63.5C42.1 64.3 40.8 63.4 40.8 61.4V53.4C40.8 52.7 41.2 52 41.7 51.8V51.8Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
    </svg>
  );
}
