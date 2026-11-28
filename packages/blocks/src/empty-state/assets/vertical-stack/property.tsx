/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ILLUSTRATION_COLOR_TOKEN_MAP } from "../helper";

export type PropertyVerticalStackIllustrationProps = {
  className?: string;
};

export function PropertyVerticalStackIllustration({ className }: PropertyVerticalStackIllustrationProps) {
  return (
    <svg
      width="161"
      height="169"
      viewBox="0 0 161 169"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <g opacity="0.2">
        <path
          d="M0.3 132.3C0.3 134.4 1.8 136.5 5 138.1L46.1 159.1C52.5 162.3 62.8 162.3 69.2 159.1L155.5 115.1C158.7 113.5 160.3 111.4 160.3 109.2V116C160.3 118.2 158.7 120.3 155.5 121.9L69.2 165.9C62.8 169.1 52.5 169.1 46.1 165.9L5 145C1.8 143.3 0.3 141.2 0.3 139.1V132.3Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M0.3 132.3C0.3 130.1 1.8 128 5 126.4L91.3 82.4C97.7 79.2 108 79.2 114.4 82.4L155.5 103.3C158.7 105 160.3 107.1 160.3 109.2C160.3 111.4 158.7 113.5 155.5 115.1L69.2 159.1C62.8 162.3 52.5 162.3 46.1 159.1L5 138.1C1.8 136.5 0.3 134.4 0.3 132.3Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <g opacity="0.6">
        <path
          d="M0.3 110.7C0.3 112.9 1.8 115 5 116.6L46.1 137.5C52.5 140.8 62.8 140.8 69.2 137.5L155.5 93.6C158.7 92 160.3 89.8 160.3 87.7V94.5C160.3 96.7 158.7 98.8 155.5 100.4L69.2 144.4C62.8 147.6 52.5 147.6 46.1 144.4L5 123.4C1.8 121.8 0.3 119.7 0.3 117.5V110.7Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M0.3 110.7C0.3 108.6 1.8 106.5 5 104.8L91.3 60.9C97.7 57.6 108 57.6 114.4 60.9L155.5 81.8C158.7 83.4 160.3 85.6 160.3 87.7C160.3 89.8 158.7 92 155.5 93.6L69.2 137.5C62.8 140.8 52.5 140.8 46.1 137.5L5 116.6C1.8 115 0.3 112.9 0.3 110.7Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <path
        d="M0.3 89.2C0.3 91.4 1.8 93.5 5 95.1L46.1 116C52.5 119.3 62.8 119.3 69.2 116L155.5 72.1C158.7 70.5 160.3 68.3 160.3 66.2V73C160.3 75.1 158.7 77.3 155.5 78.9L69.2 122.8C62.8 126.1 52.5 126.1 46.1 122.8L5 101.9C1.8 100.3 0.3 98.2 0.3 96V89.2Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M0.3 89.2C0.3 87.1 1.8 85 5 83.3L91.3 39.4C97.7 36.1 108 36.1 114.4 39.4L155.5 60.3C158.7 61.9 160.3 64.1 160.3 66.2C160.3 68.3 158.7 70.5 155.5 72.1L69.2 116C62.8 119.3 52.5 119.3 46.1 116L5 95.1C1.8 93.5 0.3 91.4 0.3 89.2Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M53.1 92.9C52.2 92.9 51.4 92.7 50.6 92.3L40.5 87.2C38.3 86 37 83.4 37 80C37 78 37.4 75.9 38.2 73.8L61.9 11.3C63.1 8.1 65.1 5.2 67.4 3.2C69.5 1.5 71.6 0.6 73.6 0.6C73.9 0.6 74.3 0.6 74.6 0.7C75.2 0.8 75.7 0.9 76.1 1.2L86.2 6.3C86.2 6.3 86.2 6.3 86.2 6.3C87.1 6.8 87.9 7.5 88.4 8.4L112.1 46.8C114.7 50.9 113.2 58.6 108.8 63.9C107.4 65.6 105.8 66.9 104.2 67.7L56.7 91.9C55.5 92.6 54.3 92.9 53.1 92.9Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
      />
      <path
        d="M73.6 1.1C73.9 1.1 74.2 1.2 74.5 1.2C75 1.3 75.5 1.5 75.9 1.7L85.9 6.8C86.7 7.2 87.4 7.8 87.9 8.7L111.6 47.1C114.1 51 112.6 58.4 108.4 63.5C107 65.2 105.5 66.4 104 67.2L56.5 91.4C55.3 92 54.1 92.3 53.1 92.3C52.2 92.3 51.4 92.1 50.7 91.7L40.7 86.7C38.8 85.7 37.5 83.3 37.5 80C37.5 78.1 38 76 38.7 74L62.4 11.5C63.6 8.4 65.5 5.6 67.8 3.7C69.7 2 71.7 1.1 73.6 1.1M73.6 0C71.5 0 69.2 1 67.1 2.8C64.6 4.8 62.6 7.8 61.4 11.1L37.7 73.6C36.9 75.8 36.4 78 36.4 80C36.4 83.6 37.8 86.4 40.2 87.7L50.3 92.8C50.3 92.8 50.4 92.8 50.4 92.9C51.2 93.2 52.1 93.4 53.1 93.4C54.3 93.4 55.7 93.1 57 92.4L104.4 68.3C106.2 67.4 107.8 66 109.3 64.2C113.9 58.6 115.3 50.9 112.6 46.5L88.9 8.1C88.3 7.1 87.5 6.3 86.5 5.8L76.4 0.6C75.9 0.4 75.3 0.2 74.7 0.1C74.4 0 74 0 73.6 0L73.6 0Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.tertiary}
      />
      <path
        d="M85.9 6.8C85.5 6.6 85 6.4 84.6 6.3C82.5 6 80.1 6.8 77.8 8.8C75.5 10.7 73.6 13.5 72.5 16.6L48.8 79.1C48 81.2 47.6 83.2 47.6 85.1C47.6 88.4 48.8 90.8 50.8 91.8L40.7 86.7C38.8 85.7 37.5 83.3 37.5 80C37.5 78.1 37.9 76 38.7 74L62.4 11.5C63.6 8.4 65.5 5.6 67.8 3.6C70.1 1.7 72.4 0.8 74.5 1.2C75 1.3 75.4 1.4 75.8 1.7L85.9 6.8Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.tertiary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M108.4 63.5C107.1 65.2 105.5 66.4 104 67.2L56.5 91.4C51.6 93.9 47.6 91.1 47.6 85.1C47.6 83.2 48 81.2 48.8 79.1L72.5 16.6C73.7 13.5 75.6 10.7 77.9 8.8C80.2 6.8 82.6 6 84.6 6.3C86 6.6 87.2 7.4 88 8.7L111.7 47.1C114.1 51 112.7 58.4 108.4 63.5Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M90.1 33.6C89.6 33.4 89 33.4 88.2 33.8C86.6 34.6 85.3 36.9 85.3 38.9V53.3C85.3 54.4 85.7 55.2 86.3 55.5L76.3 50.4C75.6 50.1 75.2 49.3 75.2 48.2V33.8C75.2 31.8 76.5 29.5 78.2 28.7C78.9 28.3 79.6 28.3 80.1 28.5L90.1 33.6Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.tertiary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M90.1 33.7C90.8 34 91.2 34.8 91.2 35.9V50.3C91.2 52.3 89.9 54.6 88.2 55.4C87.5 55.8 86.8 55.8 86.3 55.5C85.7 55.2 85.3 54.4 85.3 53.3V38.9C85.3 36.9 86.6 34.6 88.2 33.8C89 33.4 89.6 33.4 90.1 33.7Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M90.1 62.5C89.6 62.2 88.9 62.3 88.2 62.6C86.6 63.5 85.2 65.8 85.2 67.8C85.2 68.9 85.7 69.6 86.3 70L76.2 64.9C75.6 64.5 75.2 63.7 75.2 62.6C75.2 60.6 76.5 58.3 78.2 57.5C78.9 57.1 79.6 57.1 80.1 57.4L90.1 62.5Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.tertiary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M90.1 62.5C90.8 62.8 91.2 63.6 91.2 64.7C91.2 66.7 89.8 69 88.2 69.8C87.5 70.2 86.8 70.2 86.3 70C85.7 69.6 85.2 68.9 85.2 67.8C85.2 65.8 86.6 63.5 88.2 62.6C88.9 62.3 89.6 62.2 90.1 62.5V62.5Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
