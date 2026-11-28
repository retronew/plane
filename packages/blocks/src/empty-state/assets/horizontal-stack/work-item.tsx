/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ILLUSTRATION_COLOR_TOKEN_MAP } from "../helper";

export type WorkItemHorizontalStackIllustrationProps = {
  className?: string;
};

export function WorkItemHorizontalStackIllustration({ className }: WorkItemHorizontalStackIllustrationProps) {
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
          d="M55.1 7.9C54.3 7.5 53.2 7.6 52.1 8.1L21.3 23.8C18.7 25.1 16.7 28.7 16.7 31.8V69.3C16.7 71 17.3 72.2 18.3 72.7L15.2 71.2C14.2 70.7 13.6 69.4 13.6 67.7V30.2C13.6 27.1 15.7 23.6 18.2 22.3L49 6.6C50.2 6 51.2 6 52 6.4L55.1 7.9Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M55.1 7.9C56.1 8.4 56.7 9.7 56.7 11.4V48.9C56.7 52 54.6 55.5 52.1 56.8L21.3 72.5C20.1 73.1 19.1 73.1 18.3 72.7C17.3 72.2 16.7 71 16.7 69.3V31.8C16.7 28.7 18.7 25.1 21.3 23.8L52.1 8.1C53.2 7.6 54.3 7.5 55.1 7.9Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <path
        d="M68.5 13.9C67.7 13.5 66.7 13.5 65.6 14.1L34.7 29.8C32.2 31.1 30.1 34.6 30.1 37.7V75.2C30.1 77 30.8 78.2 31.8 78.7L28.7 77.1C27.7 76.6 27.1 75.4 27.1 73.7V36.1C27.1 33.1 29.1 29.5 31.7 28.2L62.5 12.5C63.6 11.9 64.6 11.9 65.4 12.3L68.5 13.9Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M68.5 13.9C69.5 14.4 70.1 15.6 70.1 17.3V54.9C70.1 57.9 68.1 61.5 65.6 62.8L34.7 78.5C33.6 79.1 32.6 79.1 31.8 78.7C30.8 78.2 30.1 77 30.1 75.2V37.7C30.1 34.6 32.2 31.1 34.7 29.8L65.6 14.1C66.7 13.5 67.7 13.5 68.5 13.9Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M52.7 40C52.9 40.4 53.3 40.6 53.8 40.3C54.4 40 55 39 55 38.2V36.7C55 36.2 54.8 35.8 54.5 35.7C54.2 35.6 53.7 35.7 53.4 36.1L45.5 43.8C45.1 44.3 44.8 45 44.8 45.6V56.2C44.8 56.7 45 57.1 45.3 57.2C45.7 57.3 46.2 57.1 46.5 56.6L47.6 55.3C48.2 54.7 48.5 53.6 48.2 53C48 52.7 47.6 52.6 47.2 52.7V45.5L52.7 40V40Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M47.9 37.9C48.1 38.3 48.5 38.5 49 38.3C49.6 37.9 50.2 37 50.2 36.1V34.6C50.2 34.1 50 33.7 49.7 33.6C49.3 33.5 48.9 33.7 48.6 34L40.7 41.8C40.3 42.2 40 42.9 40 43.6V54.1C40 54.6 40.2 55 40.5 55.1C40.9 55.2 41.3 55 41.7 54.6L42.8 53.3C43.4 52.6 43.6 51.6 43.3 51C43.1 50.6 42.8 50.5 42.4 50.7V43.4L47.9 37.9V37.9Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M60.3 49C60.3 49.6 60 50.3 59.6 50.8L51.7 58.5C51.4 58.9 50.9 59 50.6 58.9C50.3 58.8 50.1 58.5 50.1 58V47.4C50.1 46.8 50.4 46.1 50.9 45.6L58.7 37.9C59.1 37.5 59.5 37.3 59.8 37.5C60.1 37.6 60.3 37.9 60.3 38.4V49L60.3 49ZM57.9 41.9L52.5 47.2V54.5L57.9 49.2V41.9H57.9Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
    </svg>
  );
}
