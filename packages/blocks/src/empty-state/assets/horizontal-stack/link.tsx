/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ILLUSTRATION_COLOR_TOKEN_MAP } from "../helper";

export type LinkHorizontalStackIllustrationProps = {
  className?: string;
};

export function LinkHorizontalStackIllustration({ className }: LinkHorizontalStackIllustrationProps) {
  return (
    <svg
      width="51"
      height="58"
      viewBox="0 0 51 58"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <g opacity="0.2">
        <path
          d="M30.1 1.5C29.6 1.2 28.8 1.2 28 1.6L5.7 13C3.8 13.9 2.4 16.5 2.4 18.7V45.9C2.4 47.1 2.8 48 3.5 48.4L1.3 47.2C0.6 46.9 0.1 46 0.1 44.8V17.6C0.1 15.3 1.6 12.8 3.5 11.8L25.8 0.5C26.6 0 27.3 0 27.9 0.3L30.1 1.5Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M30.1 1.5C30.9 1.8 31.3 2.7 31.3 4V31.1C31.3 33.4 29.8 35.9 28 36.9L5.7 48.2C4.9 48.7 4.1 48.7 3.5 48.4C2.8 48 2.4 47.1 2.4 45.9V18.7C2.4 16.5 3.8 13.9 5.7 13L28 1.6C28.8 1.2 29.6 1.2 30.1 1.5Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <g opacity="0.6">
        <path
          d="M39.9 5.8C39.3 5.5 38.6 5.5 37.8 5.9L15.4 17.3C13.6 18.2 12.1 20.8 12.1 23V50.2C12.1 51.5 12.6 52.3 13.3 52.7L11.1 51.6C10.3 51.2 9.9 50.3 9.9 49.1V21.9C9.9 19.7 11.4 17.1 13.2 16.2L35.5 4.8C36.3 4.4 37.1 4.4 37.7 4.7L39.9 5.8Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M39.9 5.8C40.6 6.2 41.1 7 41.1 8.3V35.5C41.1 37.7 39.6 40.3 37.8 41.2L15.4 52.6C14.6 53 13.9 53 13.3 52.7C12.6 52.3 12.1 51.5 12.1 50.2V23C12.1 20.8 13.6 18.2 15.4 17.3L37.8 5.9C38.6 5.5 39.3 5.5 39.9 5.8Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <path
        d="M49.6 10.1C49.1 9.8 48.3 9.8 47.5 10.2L25.2 21.6C23.3 22.6 21.8 25.1 21.8 27.4V54.5C21.8 55.8 22.3 56.6 23 57L20.8 55.9C20.1 55.5 19.6 54.6 19.6 53.4V26.2C19.6 24 21.1 21.4 22.9 20.5L45.3 9.1C46.1 8.7 46.8 8.7 47.4 9L49.6 10.1Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M49.6 10.1C50.4 10.5 50.8 11.3 50.8 12.6V39.8C50.8 42 49.3 44.6 47.5 45.5L25.2 56.9C24.4 57.3 23.6 57.3 23 57C22.3 56.7 21.8 55.8 21.8 54.5V27.4C21.8 25.1 23.3 22.6 25.2 21.6L47.5 10.2C48.3 9.8 49.1 9.8 49.6 10.1Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M32.5 37.2C31.9 38.2 31.6 39.2 31.6 40.2C31.6 41.1 31.9 41.9 32.5 42.3C33 42.7 33.8 42.7 34.6 42.3C35.4 41.9 36.1 41.1 36.7 40.2L37.7 38.4C38 37.9 38.5 37.6 38.8 37.8C39 38 39 38.6 38.8 39.1L37.7 40.9C36.9 42.3 35.8 43.5 34.6 44.1C33.4 44.7 32.3 44.7 31.4 44.1C30.6 43.5 30.1 42.4 30.1 40.9C30.1 39.5 30.6 37.9 31.4 36.5L32.5 34.7C32.8 34.2 33.2 33.9 33.5 34.1C33.8 34.3 33.8 34.9 33.5 35.4L32.5 37.2V37.2Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M35.6 30.5C35.3 30.3 35.3 29.8 35.6 29.3L36.7 27.5C37.5 26 38.6 24.9 39.8 24.3C41 23.7 42.1 23.7 42.9 24.3C43.8 24.8 44.2 26 44.2 27.4C44.2 28.8 43.8 30.4 42.9 31.9L41.9 33.7C41.6 34.2 41.1 34.4 40.8 34.2C40.5 34 40.5 33.4 40.8 32.9L41.9 31.1C42.4 30.2 42.7 29.1 42.7 28.2C42.7 27.2 42.4 26.5 41.9 26.1C41.3 25.7 40.6 25.7 39.8 26.1C39 26.5 38.3 27.2 37.7 28.2L36.7 30C36.4 30.5 35.9 30.7 35.6 30.5V30.5Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M34.6 38.7C34.3 38.5 34.3 37.9 34.6 37.4L38.8 30.2C39 29.7 39.5 29.5 39.8 29.7C40.1 29.9 40.1 30.4 39.8 30.9L35.6 38.1C35.3 38.6 34.9 38.9 34.6 38.7Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
    </svg>
  );
}
