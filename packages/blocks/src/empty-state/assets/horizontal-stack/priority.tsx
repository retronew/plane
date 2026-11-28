/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ILLUSTRATION_COLOR_TOKEN_MAP } from "../helper";

export type PriorityHorizontalStackIllustrationProps = {
  className?: string;
};

export function PriorityHorizontalStackIllustration({ className }: PriorityHorizontalStackIllustrationProps) {
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
          d="M41.6 2C40.8 1.6 39.7 1.6 38.6 2.2L7.8 17.9C5.3 19.2 3.2 22.7 3.2 25.8V63.3C3.2 65 3.8 66.2 4.8 66.8L1.8 65.2C0.8 64.7 0.1 63.5 0.1 61.7V24.2C0.1 21.1 2.2 17.6 4.7 16.3L35.5 0.6C36.7 0 37.7 -0 38.5 0.4L41.6 2Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M41.6 2C42.6 2.5 43.2 3.7 43.2 5.4V42.9C43.2 46 41.2 49.6 38.6 50.9L7.8 66.6C6.7 67.1 5.6 67.2 4.8 66.8C3.8 66.3 3.2 65 3.2 63.3V25.8C3.2 22.7 5.3 19.2 7.8 17.9L38.6 2.2C39.8 1.6 40.8 1.6 41.6 2Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <g opacity="0.6">
        <path
          d="M55 7.9C54.2 7.5 53.2 7.5 52.1 8.1L21.3 23.8C18.7 25.1 16.7 28.7 16.7 31.7V69.3C16.7 71 17.3 72.2 18.3 72.7L15.2 71.1C14.2 70.6 13.6 69.4 13.6 67.7V30.2C13.6 27.1 15.6 23.5 18.2 22.3L49 6.5C50.1 6 51.2 5.9 52 6.3L55 7.9Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M55 7.9C56 8.4 56.7 9.6 56.7 11.4V48.9C56.7 52 54.6 55.5 52.1 56.8L21.2 72.5C20.1 73.1 19.1 73.1 18.3 72.7C17.3 72.2 16.7 71 16.7 69.3V31.7C16.7 28.7 18.7 25.1 21.3 23.8L52.1 8.1C53.2 7.5 54.2 7.5 55 7.9Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <path
        d="M68.5 13.9C67.7 13.5 66.7 13.5 65.5 14.1L34.7 29.8C32.2 31.1 30.1 34.6 30.1 37.7V75.2C30.1 76.9 30.8 78.1 31.8 78.7L28.7 77.1C27.7 76.6 27 75.4 27 73.6V36.1C27 33 29.1 29.5 31.6 28.2L62.5 12.5C63.6 11.9 64.6 11.9 65.4 12.3L68.5 13.9Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M68.5 13.9C69.5 14.4 70.1 15.6 70.1 17.3V54.8C70.1 57.9 68.1 61.5 65.5 62.8L34.7 78.5C33.6 79 32.5 79.1 31.8 78.7C30.8 78.1 30.1 76.9 30.1 75.2V37.7C30.1 34.6 32.2 31.1 34.7 29.8L65.5 14.1C66.7 13.5 67.7 13.5 68.5 13.9Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M41 63.4C40.3 63.8 39.7 63.4 39.7 62.5C39.7 61.6 40.3 60.6 41 60.3H41C41.7 59.9 42.3 60.3 42.3 61.2C42.3 62.1 41.7 63 41 63.4Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        d="M47.4 60.1C46.7 60.5 46.2 60.1 46.2 59.2V53C46.2 52.1 46.7 51.1 47.4 50.8C48.2 50.4 48.7 50.8 48.7 51.7V57.9C48.7 58.8 48.2 59.8 47.4 60.1Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        d="M53.9 56.9C53.2 57.2 52.6 56.8 52.6 56V43.4C52.6 42.6 53.2 41.6 53.9 41.2C54.6 40.9 55.2 41.3 55.2 42.1V54.7C55.2 55.5 54.6 56.5 53.9 56.9Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        d="M60.3 53.6C59.6 53.9 59 53.5 59 52.7V33.9C59 33.1 59.6 32.1 60.3 31.7C61 31.3 61.6 31.7 61.6 32.6V51.4C61.6 52.2 61 53.2 60.3 53.6Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
    </svg>
  );
}
