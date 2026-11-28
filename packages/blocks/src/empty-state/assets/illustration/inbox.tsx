/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ILLUSTRATION_COLOR_TOKEN_MAP } from "../helper";

export type InboxIllustrationProps = {
  className?: string;
};

export function InboxIllustration({ className }: InboxIllustrationProps) {
  return (
    <svg
      width="100"
      height="92"
      viewBox="0 0 100 92"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M48 90.4C45.6 90.4 43.4 90 41.7 89.1L3.4 69.6C1.6 68.7 0.6 67.4 0.6 66V46.1C0.6 44.7 1.6 43.4 3.4 42.5L45.7 20.9C47.4 20.1 49.7 19.6 52 19.6C54.4 19.6 56.6 20.1 58.3 20.9L96.6 40.4C98.4 41.3 99.4 42.6 99.4 44V63.9C99.4 65.3 98.4 66.6 96.6 67.5L54.2 89.1C52.6 90 50.3 90.4 48 90.4L48 90.4Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
      />
      <path
        d="M52 20.2C54.2 20.2 56.4 20.6 58 21.5L96.3 41C98 41.8 98.8 42.9 98.8 44V63.9C98.8 65.1 98 66.2 96.3 67L54 88.6C52.3 89.4 50.1 89.8 48 89.8C45.8 89.8 43.6 89.4 42 88.6L3.7 69.1C2 68.2 1.2 67.1 1.2 66V46.1C1.2 45 2 43.9 3.7 43L46 21.5C47.7 20.6 49.8 20.2 52 20.2M52 19C49.6 19 47.2 19.5 45.5 20.4L3.1 42C1.1 43 0 44.5 0 46.1V66C0 66.9 0.4 68.7 3.1 70.1L41.4 89.6C43.2 90.5 45.5 91 48 91C50.4 91 52.8 90.5 54.5 89.6L96.9 68.1C98.9 67 100 65.6 100 63.9V44C100 43.1 99.6 41.3 96.9 39.9L58.6 20.4C56.8 19.5 54.5 19 52 19V19Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
      />
      <path
        d="M86.8 46C86.7 46 86.6 46.1 86.5 46.1L79.4 49.7L79.4 49.8L79.4 49.7L86.8 46L86.8 46Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.3024"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M76.7 56.1L76.1 57.4L75.2 59.6C74.7 60.7 73.9 61.6 73.1 62L64.4 66.5L62.7 64.2L56.8 61.2H56.8L51.8 63.8C49.1 65 45 64.9 42.4 63.6L28.2 56.4L47.9 46.4C50.5 45 54.9 45 57.6 46.4L71.8 53.6L76.6 56.1L76.7 56.1Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.3024"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M88.5 43.7C88.5 44.5 87.9 45.3 86.8 46L79.4 49.7L79.4 49.7L76.7 56.1L71.8 53.6L57.6 46.4C54.9 45 50.6 45 47.9 46.4L28.2 56.4L13.5 48.9C12.2 48.2 11.5 47.3 11.5 46.4C11.5 45.5 12.2 44.7 13.5 44L47.9 26.5C50.6 25.1 54.9 25.1 57.6 26.5L86.4 41.2C87.8 41.9 88.5 42.8 88.5 43.7V43.7Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.tertiary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.3024"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M98.8 44C98.8 45.1 98 46.2 96.4 47.1L88.5 51.1L85.3 52.7L79.4 49.7L86.4 46.1C86.6 46.1 86.7 46 86.8 45.9C87.9 45.3 88.5 44.5 88.5 43.7C88.5 42.8 87.8 41.9 86.4 41.2L57.6 26.5C54.9 25.1 50.5 25.1 47.9 26.5L13.5 44C12.2 44.7 11.5 45.5 11.5 46.4C11.5 47.3 12.2 48.2 13.5 48.9L28.2 56.4L42.4 63.6C45 64.9 49.1 65 51.8 63.8C51.9 63.7 52 63.7 52.1 63.6L56.8 61.2L62.7 64.2L54 68.6C53.1 69.1 52.1 69.4 51 69.6C49.3 70 47.4 70 45.7 69.8C44.3 69.6 43 69.2 42 68.6L23.1 59L11.5 53.1L3.7 49.1C2 48.3 1.2 47.2 1.2 46.1C1.2 45 2 43.9 3.7 43L46 21.5C49.3 19.8 54.7 19.8 58 21.5L96.3 41C98 41.8 98.8 42.9 98.8 44L98.8 44Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.3024"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M86.8 46C86.7 46 86.6 46.1 86.5 46.1L79.4 49.7H79.4L86.8 46V46Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.3024"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M85.3 52.7L82.5 59.1L81 62.6C80.5 63.7 79.8 64.6 78.9 65L69 70.1C68.4 70.4 67.8 70.4 67.4 70.2C67.2 70.1 67 70 66.9 69.8L64.4 66.5L73.1 62C73.9 61.6 74.7 60.7 75.2 59.6L76.1 57.4L76.7 56.1L79.4 49.7L79.4 49.7L85.3 52.7L85.3 52.7Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.3024"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M79.4 49.7L79.4 49.7L79.4 49.7L79.4 49.7Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.3024"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M98.8 44V63.9C98.8 65.1 98 66.2 96.3 67L54 88.6C50.7 90.3 45.3 90.3 42 88.6L3.7 69.1C2 68.2 1.2 67.1 1.2 66V46.1C1.2 47.2 2 48.3 3.7 49.2L11.5 53.1L23.1 59L42 68.7C43 69.2 44.3 69.6 45.7 69.8C47.4 70 49.3 70 51 69.6C52.1 69.4 53.1 69.1 54 68.7L62.7 64.2L64.4 66.5L66.9 69.8C67 70 67.2 70.1 67.4 70.2C67.8 70.4 68.4 70.4 69 70.1L78.9 65C79.8 64.6 80.5 63.7 81 62.6L82.5 59.1L85.3 52.7L88.5 51.1L96.4 47.1C98 46.2 98.8 45.1 98.8 44V44Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.tertiary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.3024"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M56.8 61.2L52.1 63.6C52 63.7 51.9 63.7 51.8 63.8L56.8 61.2H56.8L56.8 61.2Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.3024"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M43.3 50.3C42.8 50.3 42.3 50.2 41.9 50L36.5 47.2C35.3 46.6 34.6 45.2 34.6 43.4V23.4C34.6 23.4 34.6 23.4 34.6 23.3V21.5C34.6 18.3 36.8 14.6 39.4 13.3L63.3 1.1C63.9 0.8 64.6 0.6 65.3 0.6C65.8 0.6 66.3 0.7 66.7 0.9L72 3.7C73.3 4.3 74 5.7 74 7.6V9.4C74 9.4 74 9.4 74 9.4V29.4C74 32.6 71.8 36.3 69.2 37.6L45.3 49.8C44.6 50.1 44 50.3 43.3 50.3V50.3Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
      />
      <path
        d="M65.3 1.2C65.7 1.2 66.1 1.3 66.4 1.5L71.8 4.2C72.8 4.7 73.4 5.9 73.4 7.6V9.4C73.4 9.4 73.4 9.4 73.4 9.4V29.4C73.4 32.4 71.4 35.8 68.9 37.1L45 49.2C44.4 49.5 43.9 49.7 43.3 49.7C42.9 49.7 42.5 49.6 42.2 49.4L36.8 46.7C35.8 46.2 35.2 45 35.2 43.3V23.4C35.2 23.4 35.2 23.4 35.2 23.4V21.5C35.2 18.6 37.2 15.1 39.7 13.8L63.5 1.7C64.2 1.4 64.7 1.2 65.3 1.2M65.3 0C64.5 0 63.8 0.2 63 0.6L39.1 12.8C36.3 14.2 34 18.1 34 21.6V23.3C34 23.3 34 23.4 34 23.4V43.4C34 45.4 34.8 47 36.3 47.8L41.6 50.5C42.2 50.8 42.7 50.9 43.3 50.9C44.1 50.9 44.8 50.7 45.6 50.3L69.5 38.2C72.3 36.7 74.6 32.8 74.6 29.4V9.4C74.6 9.4 74.6 9.4 74.6 9.4V7.6C74.6 5.5 73.8 3.9 72.3 3.1L67 0.4C66.4 0.1 65.9 0 65.3 0V0Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
      />
      <path
        d="M72.8 8.3C72.4 8 71.7 8.3 71.1 9.1L70.4 9.9L57.7 26.2C57.3 26.8 56.7 27.1 56.3 27L43.6 23.6L42.9 23.4C42.2 23.2 41.2 24 40.8 25C40.6 25.4 40.6 25.8 40.6 26.1V46.1C40.6 47.7 41.2 48.9 42.2 49.4L36.8 46.7C35.8 46.2 35.2 45 35.2 43.3V23.4C35.2 23.1 35.3 22.7 35.4 22.3C35.9 21.2 36.8 20.5 37.5 20.7L38.2 20.9L50.9 24.2C51.3 24.3 51.9 24 52.4 23.5L65 7.2L65.7 6.3C66.3 5.6 67 5.3 67.5 5.6L72.8 8.3Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.tertiary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.3024"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M72.8 8.3C73 8.3 73.1 8.4 73.1 8.5C73.3 8.8 73.4 9.1 73.4 9.4V29.4C73.4 32.4 71.4 35.8 68.9 37.1L45 49.2C44 49.8 43 49.8 42.2 49.4C41.2 48.9 40.6 47.8 40.6 46.1V26.1C40.6 25.8 40.6 25.4 40.8 25C41.2 24 42.2 23.2 42.9 23.4L43.6 23.6L56.3 27C56.7 27.1 57.3 26.8 57.7 26.2L70.4 9.9L71.1 9.1C71.7 8.3 72.4 8 72.9 8.3L72.8 8.3Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.3024"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M71.8 4.2C71 3.8 70 3.8 68.9 4.4L45.1 16.6C42.6 17.8 40.6 21.3 40.6 24.3V26.1C40.6 26.6 40.8 27 41.1 27.2L35.7 24.5C35.4 24.3 35.2 23.9 35.2 23.4V21.5C35.2 18.6 37.2 15.1 39.7 13.8L63.6 1.7C64.6 1.1 65.6 1.1 66.4 1.5L71.8 4.2Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.tertiary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.3024"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M71.8 4.2C72.8 4.7 73.4 5.9 73.4 7.6V9.4C73.4 10 73.1 10.7 72.7 11.3L70.4 14.2L59.3 28.5C58.6 29.4 57.8 30 57 30.4C56.2 30.8 55.4 31 54.7 30.8L43.6 27.9L41.3 27.3C41.2 27.2 41.2 27.2 41.1 27.2C40.8 27 40.6 26.6 40.6 26.1V24.3C40.6 21.3 42.6 17.8 45.1 16.6L68.9 4.4C70 3.8 71 3.8 71.8 4.2Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.3024"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
