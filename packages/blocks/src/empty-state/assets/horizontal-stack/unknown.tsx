/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ILLUSTRATION_COLOR_TOKEN_MAP } from "../helper";

export type UnknownHorizontalStackIllustrationProps = {
  className?: string;
};

export function UnknownHorizontalStackIllustration({ className }: UnknownHorizontalStackIllustrationProps) {
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
          d="M41.6 2C40.8 1.6 39.8 1.6 38.7 2.2L7.8 17.9C5.3 19.2 3.3 22.8 3.3 25.8V63.4C3.3 65.1 3.9 66.3 4.9 66.8L1.8 65.3C0.8 64.7 0.2 63.5 0.2 61.8V24.3C0.2 21.2 2.2 17.7 4.8 16.4L35.6 0.6C36.7 0.1 37.8 0 38.6 0.5L41.6 2Z"
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
          d="M55.1 8C54.3 7.6 53.3 7.6 52.1 8.2L21.3 23.9C18.8 25.2 16.7 28.7 16.7 31.8V69.4C16.7 71.1 17.3 72.3 18.3 72.8L15.3 71.2C14.3 70.7 13.6 69.5 13.6 67.8V30.3C13.6 27.2 15.7 23.6 18.2 22.3L49.1 6.6C50.2 6.1 51.2 6 52 6.4L55.1 8Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.35"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M55.1 8C56.1 8.5 56.7 9.7 56.7 11.4V49C56.7 52.1 54.7 55.6 52.1 56.9L21.3 72.6C20.2 73.2 19.1 73.2 18.3 72.8C17.3 72.3 16.7 71.1 16.7 69.4V31.8C16.7 28.7 18.8 25.2 21.3 23.9L52.1 8.2C53.3 7.6 54.3 7.6 55.1 8Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.35"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <path
        d="M68.5 14C67.7 13.5 66.7 13.6 65.6 14.1L34.8 29.9C32.2 31.2 30.2 34.7 30.2 37.8V75.3C30.2 77 30.8 78.2 31.8 78.8L28.7 77.2C27.7 76.7 27.1 75.5 27.1 73.7V36.2C27.1 33.1 29.1 29.6 31.7 28.3L62.5 12.6C63.6 12 64.7 12 65.5 12.4L68.5 14Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M68.5 14C69.5 14.5 70.2 15.7 70.2 17.4V54.9C70.2 58 68.1 61.6 65.6 62.8L34.7 78.6C33.6 79.1 32.6 79.2 31.8 78.8C30.8 78.2 30.2 77 30.2 75.3V37.8C30.2 34.7 32.2 31.2 34.8 29.9L65.6 14.1C66.7 13.6 67.7 13.5 68.5 14Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M51.2 53.1C50.7 53.4 50.3 53.1 50.3 52.5C50.3 51.9 50.6 51.2 51.1 51H51.2C51.6 50.7 52.1 51 52.1 51.6C52.1 52.2 51.6 52.9 51.2 53.1Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        d="M56.5 55.9L45.8 61.3C44.3 62.1 43.1 61.2 43.1 59.4V42C43.1 40.2 44.3 38.1 45.8 37.4L53.8 33.2C54.1 33.1 54.3 33.1 54.5 33.2L59 36.4C59.1 36.5 59.2 36.8 59.2 37V51.2C59.2 53 58 55.1 56.5 55.9H56.5ZM45.8 39.5C45.3 39.8 44.9 40.5 44.9 41.1V58.5C44.9 59.1 45.3 59.4 45.8 59.1L56.5 53.7C57 53.4 57.4 52.7 57.4 52.1V38.4L53.5 35.6L45.8 39.5V39.5Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        d="M51.1 48.8C50.7 49 50.4 48.9 50.2 48.5C50.1 48 50.3 47.3 50.8 46.8C51.3 46.3 52.9 44.7 52.9 43.5C52.9 42.7 52.4 42.1 51.7 42.1C51.2 42.2 50.8 42.4 50.3 42.9C49.9 43.4 49.6 44 49.4 44.6C49.2 45.3 48.7 45.8 48.3 45.8C47.8 45.9 47.5 45.4 47.7 44.7C48.4 42.1 50.4 39.9 52.3 39.8C53.7 39.7 54.7 40.8 54.7 42.6C54.7 45.5 51.7 48.3 51.4 48.6C51.3 48.7 51.2 48.8 51.1 48.8L51.1 48.8Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
    </svg>
  );
}
