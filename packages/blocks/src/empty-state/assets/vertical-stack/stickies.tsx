/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ILLUSTRATION_COLOR_TOKEN_MAP } from "../helper";

export type StickiesVerticalStackIllustrationProps = {
  className?: string;
};

export function StickiesVerticalStackIllustration({ className }: StickiesVerticalStackIllustrationProps) {
  return (
    <svg
      width="160"
      height="186"
      viewBox="0 0 160 186"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <g clipPath="url(#clip0_1323_9223)">
        <g opacity="0.2">
          <path
            d="M0.1 150C0.1 152.1 1.7 154.2 4.9 155.8L45.9 176.7C52.3 179.9 62.6 179.9 69 176.7L155.1 132.9C158.3 131.3 159.9 129.2 159.9 127V133.8C159.9 135.9 158.3 138.1 155.1 139.7L69 183.4C62.6 186.7 52.3 186.7 45.9 183.4L4.9 162.6C1.7 161 0.1 158.9 0.1 156.7V150Z"
            fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
            stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
            strokeWidth="0.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M0.1 150C0.1 147.8 1.7 145.7 4.9 144.1L91 100.3C97.4 97.1 107.7 97.1 114.1 100.3L155.1 121.2C158.3 122.8 159.9 124.9 159.9 127C159.9 129.2 158.3 131.3 155.1 132.9L69 176.7C62.6 179.9 52.3 179.9 45.9 176.7L4.9 155.8C1.7 154.2 0.1 152.1 0.1 150Z"
            fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
            stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
            strokeWidth="0.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
        <g opacity="0.6">
          <path
            d="M0.1 128.8C0.1 130.9 1.7 133 4.9 134.7L45.9 155.5C52.3 158.7 62.6 158.7 69 155.5L155.1 111.7C158.3 110.1 159.9 108 159.9 105.9V112.6C159.9 114.8 158.3 116.9 155.1 118.5L69 162.3C62.6 165.5 52.3 165.5 45.9 162.3L4.9 141.4C1.7 139.8 0.1 137.7 0.1 135.6V128.8V128.8Z"
            fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
            stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
            strokeWidth="0.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M0.1 128.8C0.1 126.7 1.7 124.5 4.9 122.9L91 79.2C97.4 75.9 107.7 75.9 114.1 79.2L155.1 100C158.3 101.6 159.9 103.7 159.9 105.9C159.9 108 158.3 110.1 155.1 111.7L69 155.5C62.6 158.7 52.3 158.7 45.9 155.5L4.9 134.6C1.7 133 0.1 130.9 0.1 128.8V128.8Z"
            fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
            stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
            strokeWidth="0.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
        <path
          d="M0.1 107.6C0.1 109.7 1.7 111.9 4.9 113.5L45.9 134.3C52.3 137.5 62.6 137.5 69 134.3L155.1 90.5C158.3 88.9 159.9 86.8 159.9 84.7V91.5C159.9 93.6 158.3 95.7 155.1 97.3L69 141.1C62.6 144.3 52.3 144.3 45.9 141.1L4.9 120.3C1.7 118.6 0.1 116.5 0.1 114.4V107.6Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M0.1 107.6C0.1 105.5 1.7 103.4 4.9 101.7L91 58C97.4 54.7 107.7 54.7 114.1 58L155.1 78.8C158.3 80.4 159.9 82.6 159.9 84.7C159.9 86.8 158.3 88.9 155.1 90.5L69 134.3C62.6 137.5 52.3 137.5 45.9 134.3L4.9 113.5C1.7 111.9 0.1 109.7 0.1 107.6Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M90.6 1.1C91.8 1.1 93 1.4 94 1.9L100.4 5.1C100.2 5.1 100.1 5 99.9 4.9C100.1 5 100.2 5.1 100.4 5.1C102.1 6.1 103.5 7.7 104.3 9.9C104.4 9.9 104.5 9.9 104.6 9.9C105.9 9.9 107.1 10.2 108.1 10.7L114.4 14C117.4 15.5 119.3 19 119.3 24.1V53.1C111.2 67 106.6 74.9 98.5 88.8L98.5 88.9L74.7 101C72.8 101.9 71.1 102.3 69.4 102.3C68.2 102.3 67 102.1 66 101.5C64.1 100.6 62.7 98.8 61.9 96.4C62.7 98.8 64.1 100.6 66 101.5L59.6 98.3C57.9 97.4 56.5 95.8 55.7 93.5C55.6 93.5 55.5 93.5 55.4 93.5C54.1 93.5 52.9 93.3 51.9 92.7C50 91.8 48.6 90 47.8 87.6C48.6 90 50 91.8 51.9 92.7L45.6 89.5C42.6 88 40.7 84.4 40.7 79.3V41.7C40.7 32.6 46.8 22.1 54.3 18.3L85.3 2.5C87.2 1.6 88.9 1.1 90.5 1.1M56.6 24.3C57.8 23.2 59.2 22.2 60.6 21.5L91.7 5.7L60.6 21.5C59.2 22.2 57.8 23.2 56.6 24.3M105.2 14.8L105.7 14.5C106.7 14.1 107.6 13.7 108.5 13.5C107.6 13.7 106.7 14.1 105.7 14.5L105.2 14.8M90.6 0C88.7 0 86.8 0.5 84.8 1.5L53.8 17.3C45.9 21.3 39.6 32.2 39.6 41.7V79.3C39.6 84.7 41.6 88.7 45.1 90.5L51.4 93.7C52.5 94.3 53.6 94.6 54.9 94.6C55.9 96.8 57.3 98.4 59.1 99.3L65.5 102.5C66.7 103.1 68 103.5 69.5 103.5C71.3 103.5 73.2 103 75.2 102L99 89.9L99 89.8C99.2 89.7 99.4 89.6 99.5 89.4C107.6 75.4 112.2 67.6 120.3 53.6C120.4 53.4 120.4 53.2 120.4 53V24.1C120.4 18.8 118.4 14.7 115 13C115 13 115 13 115 13L108.6 9.7C107.6 9.2 106.4 8.9 105.1 8.8C104.2 6.7 102.7 5.1 100.9 4.1L94.5 0.9C93.3 0.3 92 0 90.6 0L90.6 0Z"
          fill="#011520"
        />
        <path
          d="M114.4 14C112.1 12.8 109 12.9 105.7 14.5L74.7 30.3C67.2 34.1 61.1 44.6 61.1 53.7V91.4C61.1 96.5 63 100 66 101.5L59.6 98.3C56.7 96.8 54.8 93.2 54.8 88.2V50.5C54.8 41.4 60.9 30.9 68.4 27.1L99.4 11.3C102.7 9.6 105.7 9.5 108.1 10.7L114.4 14Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.tertiary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M119.3 24.1V53C111.2 67 106.6 74.9 98.5 88.8L98.5 88.9L74.7 100.9C71.4 102.6 68.3 102.7 66 101.5C63 100 61.1 96.4 61.1 91.4V53.7C61.1 44.6 67.2 34.1 74.7 30.3L105.7 14.5C109 12.9 112.1 12.8 114.4 14C117.4 15.5 119.3 19 119.3 24.1Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M119.2 52.9V53C111 67 106.5 74.8 98.4 88.8L98.3 88.8V78.3C98.3 76.2 98.3 74.4 98.4 73C98.5 71.5 98.7 70.1 99.2 68.6C100 66.3 101.3 64 102.9 62.3C103.9 61.1 105 60.3 106.2 59.6C107.4 58.9 108.8 58.2 110.6 57.3L119.2 52.9V52.9Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
        />
        <path
          d="M100.4 5.1C98 3.9 95 4 91.6 5.7L60.6 21.5C53.1 25.3 47 35.8 47 44.9V82.6C47 87.6 48.9 91.2 51.9 92.7L45.6 89.5C42.6 88 40.7 84.4 40.7 79.3V41.7C40.7 32.6 46.8 22.1 54.3 18.3L85.3 2.5C88.6 0.8 91.7 0.7 94 1.9L100.4 5.1Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.tertiary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M105.2 15.3V44.2C97.1 58.2 92.6 66 84.4 80L84.4 80L60.6 92.1C57.3 93.8 54.3 93.9 51.9 92.7C48.9 91.2 47 87.6 47 82.6V44.9C47 35.8 53.1 25.3 60.6 21.5L91.7 5.7C95 4 98 3.9 100.4 5.1C103.3 6.7 105.2 10.2 105.2 15.3Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M105.1 44.1V44.2C97 58.2 92.4 66 84.3 79.9L84.2 80V69.5C84.2 67.4 84.2 65.6 84.3 64.2C84.4 62.7 84.6 61.2 85.2 59.8C86 57.4 87.2 55.2 88.8 53.5C89.8 52.3 90.9 51.5 92.1 50.8C93.3 50.1 94.7 49.4 96.5 48.5L105.1 44.1V44.1Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
        />
      </g>
      <defs>
        <clipPath id="clip0_1323_9223">
          <rect width="160" height="186" fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary} />
        </clipPath>
      </defs>
    </svg>
  );
}
