/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ILLUSTRATION_COLOR_TOKEN_MAP } from "../helper";

export type ScriptHorizontalStackIllustrationProps = {
  className?: string;
};

export function ScriptHorizontalStackIllustration({ className }: ScriptHorizontalStackIllustrationProps) {
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
        d="M51.1 32.8C44.4 36.3 38.9 45.7 38.9 53.9C38.9 62.1 44.4 66 51.1 62.5C57.9 59.1 63.3 49.7 63.3 41.5C63.3 33.3 57.8 29.4 51.1 32.8ZM46.1 53.5L43.9 56C43.3 54.9 43 53.5 43 51.8C43 50.1 43.3 48.4 43.9 46.7L46.1 47C45.7 48.2 45.4 49.4 45.4 50.6C45.4 51.8 45.7 52.8 46.1 53.5V53.5ZM51.1 57.6C49.7 58.3 48.4 58.5 47.3 58.4L48.4 55.2C49.2 55.3 50.1 55.1 51.1 54.6C52.1 54.1 53 53.4 53.8 52.4L55 54.5C53.8 55.8 52.5 56.9 51.1 57.6V57.6ZM53.8 40.2C53 40.1 52.1 40.2 51.1 40.7C50.1 41.2 49.2 42 48.4 42.9L47.3 40.9C48.4 39.6 49.7 38.5 51.1 37.8C52.5 37.1 53.8 36.8 55 37L53.8 40.2V40.2ZM58.3 48.7L56.1 48.4C56.6 47.2 56.8 46 56.8 44.8C56.8 43.6 56.6 42.6 56.1 41.8L58.3 39.3C58.9 40.4 59.3 41.8 59.3 43.5C59.3 45.2 58.9 47 58.3 48.7Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
    </svg>
  );
}
