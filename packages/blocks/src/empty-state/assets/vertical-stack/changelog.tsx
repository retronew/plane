/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ILLUSTRATION_COLOR_TOKEN_MAP } from "../helper";

export type ChangelogVerticalStackIllustrationProps = {
  className?: string;
};

export function ChangelogVerticalStackIllustration({ className, ...rest }: ChangelogVerticalStackIllustrationProps) {
  return (
    <svg
      width="162"
      height="172"
      viewBox="0 0 162 172"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...rest}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M15.8 47.4C14.6 46.8 13 46.9 11.3 47.7C7.4 49.7 4.3 55.2 4.3 59.9C4.3 62.6 5.2 64.4 6.8 65.2L4.3 63.9C2.7 63.2 1.7 61.3 1.7 58.6C1.7 53.9 4.9 48.4 8.8 46.5C10.5 45.6 12.1 45.5 13.3 46.2L15.8 47.4Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M15.8 47.4C17.4 48.2 18.4 50.1 18.4 52.7C18.4 57.5 15.2 62.9 11.3 64.9C9.6 65.8 8 65.8 6.8 65.2C5.2 64.4 4.3 62.6 4.3 59.9C4.3 55.2 7.4 49.7 11.3 47.7C13 46.9 14.6 46.8 15.8 47.4Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.1 55.4L9.1 55.4M9.1 60.2L9.1 60.2M8.9 57.1L13.6 54.4C14 54.2 14.1 54.1 14.3 53.9C14.4 53.7 14.5 53.5 14.6 53.4C14.7 53.1 14.7 52.9 14.7 52.5V51.8C14.7 51.4 14.7 51.2 14.6 51C14.5 50.9 14.4 50.9 14.3 50.9C14.1 50.9 14 51 13.6 51.2L8.9 53.9C8.5 54.1 8.3 54.2 8.1 54.4C8 54.6 7.9 54.8 7.8 54.9C7.7 55.2 7.7 55.4 7.7 55.8V56.5C7.7 56.9 7.7 57.1 7.8 57.3C7.9 57.4 8 57.4 8.1 57.4C8.3 57.4 8.5 57.3 8.9 57.1ZM8.9 61.9L13.6 59.2C14 59 14.1 58.9 14.3 58.7C14.4 58.5 14.5 58.3 14.6 58.2C14.7 57.9 14.7 57.7 14.7 57.3V56.6C14.7 56.2 14.7 56 14.6 55.8C14.5 55.7 14.4 55.7 14.3 55.7C14.1 55.7 14 55.8 13.6 56L8.9 58.7C8.5 58.9 8.3 59 8.1 59.2C8 59.4 7.9 59.6 7.8 59.7C7.7 60 7.7 60.2 7.7 60.6V61.3C7.7 61.7 7.7 61.9 7.8 62.1C7.9 62.2 8 62.2 8.1 62.2C8.3 62.2 8.5 62.1 8.9 61.9Z"
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <g opacity="0.2">
        <path
          d="M2.2 134.9C2.2 137 3.8 139.2 7 140.8L47.9 161.7C54.3 164.9 64.6 164.9 71 161.7L157 117.8C160.2 116.2 161.7 114.1 161.7 112V118.7C161.7 120.9 160.2 123 157 124.6L71 168.4C64.6 171.7 54.3 171.7 47.9 168.4L7 147.6C3.8 146 2.2 143.8 2.2 141.7V134.9Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M2.2 134.9C2.2 132.8 3.8 130.7 7 129.1L93 85.2C99.4 82 109.7 82 116 85.2L157 106.1C160.2 107.7 161.7 109.8 161.7 112C161.7 114.1 160.2 116.2 157 117.8L71 161.7C64.6 164.9 54.3 164.9 47.9 161.7L7 140.8C3.8 139.2 2.2 137 2.2 134.9Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <g opacity="0.6">
        <path
          d="M2.2 113.5C2.2 115.6 3.8 117.7 7 119.3L47.9 140.2C54.3 143.4 64.6 143.4 71 140.2L157 96.4C160.2 94.7 161.7 92.6 161.7 90.5V97.3C161.7 99.4 160.2 101.5 157 103.2L71 147C64.6 150.2 54.3 150.2 47.9 147L7 126.1C3.8 124.5 2.2 122.4 2.2 120.3V113.5Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M2.2 113.5C2.2 111.3 3.8 109.2 7 107.6L93 63.8C99.4 60.5 109.7 60.5 116 63.8L157 84.6C160.2 86.2 161.7 88.4 161.7 90.5C161.7 92.6 160.2 94.7 157 96.4L71 140.2C64.6 143.4 54.3 143.4 47.9 140.2L7 119.3C3.8 117.7 2.2 115.6 2.2 113.5Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="0.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <path
        d="M2.2 92C2.2 94.1 3.8 96.3 7 97.9L47.9 118.7C54.3 122 64.6 122 71 118.7L157 74.9C160.2 73.3 161.7 71.2 161.7 69V75.8C161.7 78 160.2 80.1 157 81.7L71 125.5C64.6 128.8 54.3 128.8 47.9 125.5L7 104.7C3.8 103.1 2.2 100.9 2.2 98.8V92Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M2.2 92C2.2 89.9 3.8 87.8 7 86.1L93 42.3C99.4 39.1 109.7 39.1 116 42.3L157 63.2C160.2 64.8 161.7 66.9 161.7 69C161.7 71.2 160.2 73.3 157 74.9L71 118.7C64.6 122 54.3 122 47.9 118.7L7 97.9C3.8 96.3 2.2 94.1 2.2 92Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M70.1 92.4C69.5 92.4 68.8 92.3 68.3 92L63.3 89.4C61.7 88.6 60.8 86.8 60.8 84.4V25.7C60.8 21.4 63.7 16.5 67.2 14.7L94.3 0.9C94.4 0.9 94.5 0.8 94.6 0.8C94.7 0.8 94.7 0.9 94.8 0.9L99.8 3.5C99.8 3.5 99.9 3.5 99.9 3.5L115 14.2C115.1 14.3 115.2 14.4 115.2 14.6V62.4C115.2 66.6 112.4 71.5 108.9 73.3L72.7 91.7C71.8 92.2 70.9 92.4 70.1 92.4H70.1Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
      />
      <path
        d="M94.6 1.4L99.6 4L114.7 14.6V62.4C114.7 66.4 112 71.1 108.6 72.8L72.4 91.2C71.6 91.7 70.8 91.8 70.1 91.8C69.5 91.8 69 91.7 68.6 91.5L63.5 88.9C62.2 88.3 61.4 86.7 61.4 84.4V25.7C61.4 21.6 64.1 16.9 67.4 15.2L94.6 1.4M94.6 0.3C94.4 0.3 94.2 0.3 94.1 0.4L66.9 14.2C63.2 16.1 60.3 21.2 60.3 25.7V84.4C60.3 87 61.3 89 63 89.9L68 92.5C68.7 92.8 69.4 93 70.1 93C71 93 72 92.7 72.9 92.2L109.2 73.8C112.9 71.9 115.8 66.9 115.8 62.4V14.6C115.8 14.3 115.6 13.9 115.3 13.7L100.2 3C100.2 3 100.1 3 100.1 3L95.1 0.4C94.9 0.3 94.7 0.3 94.6 0.3V0.3Z"
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
      />
      <path
        d="M99.6 4L72.4 17.8C69.1 19.5 66.4 24.2 66.4 28.2V87C66.4 89.2 67.2 90.8 68.6 91.5L63.5 88.9C62.2 88.3 61.4 86.7 61.4 84.4V25.7C61.4 21.6 64.1 16.9 67.4 15.2L94.6 1.4L99.6 4Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M99.6 4L114.7 14.6V62.4C114.7 66.4 112 71.1 108.6 72.8L72.4 91.2C71 92 69.6 92 68.6 91.5C67.2 90.8 66.4 89.2 66.4 87V28.2C66.4 24.2 69.1 19.5 72.4 17.8L99.6 4V4Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M94 64.8L76.7 73.6C75.6 74.1 74.7 73.5 74.7 72.2C74.7 70.9 75.6 69.4 76.7 68.9L94 60.1C95 59.5 95.9 60.1 95.9 61.4C95.9 62.7 95 64.2 94 64.8Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
      />
      <path
        d="M102.2 46.5L76.7 59.4C75.6 60 74.7 59.4 74.7 58.1C74.7 56.8 75.6 55.3 76.7 54.7L102.2 41.8C103.3 41.2 104.1 41.8 104.1 43.1C104.1 44.4 103.3 45.9 102.2 46.5Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
      />
      <path d="M99.6 4V15C99.6 19 102.3 20.9 105.6 19.2L114.7 14.6" fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary} />
      <path
        d="M99.6 4V15C99.6 19 102.3 20.9 105.6 19.2L114.7 14.6"
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <g clipPath="url(#clip0_1278_188)">
        <path
          d="M87.4 35L86.2 37.1L85 36.4M86.3 36.6C86.4 36.4 86.4 36.2 86.4 35.9C86.4 32.5 84 31.1 81 32.8C78 34.5 75.6 38.7 75.6 42.2C75.6 45.6 78 47 81 45.3C82.7 44.3 84.2 42.5 85.2 40.6M81 35.6V39.1L82.8 39.4"
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M138.6 1.9C139.8 1.3 141.4 1.3 143.1 2.2C147 4.2 150.2 9.6 150.2 14.4C150.2 17 149.2 18.9 147.6 19.7L150.1 18.4C151.7 17.6 152.7 15.8 152.7 13.1C152.7 8.4 149.5 2.9 145.6 0.9C143.9 0 142.3 -0 141.1 0.6L138.6 1.9Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M138.6 1.9C137 2.7 136 4.6 136 7.2C136 11.9 139.2 17.4 143.1 19.4C144.8 20.3 146.4 20.3 147.6 19.7C149.2 18.9 150.2 17 150.2 14.4C150.2 9.6 147 4.2 143.1 2.2C141.4 1.3 139.8 1.3 138.6 1.9Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M139.5 6.7C139.5 6.4 139.6 6.3 139.8 6.4L146.8 9.9C147 10 147.2 10.3 147.2 10.6C147.2 10.9 147 11 146.8 10.9L139.8 7.3C139.6 7.2 139.5 6.9 139.5 6.7ZM139.5 9C139.5 8.8 139.6 8.6 139.8 8.8L143.7 10.7C143.9 10.8 144.1 11.1 144.1 11.4C144.1 11.6 143.9 11.8 143.7 11.7L139.8 9.7C139.6 9.6 139.5 9.3 139.5 9ZM139.8 10.6C139.6 10.5 139.5 10.6 139.5 10.9C139.5 11.2 139.6 11.5 139.8 11.6L142.5 12.9C142.8 13 142.9 12.9 142.9 12.7C142.9 12.4 142.8 12.1 142.5 12L139.8 10.6ZM139.5 12.8C139.5 12.5 139.6 12.4 139.8 12.5L141.4 13.3C141.6 13.4 141.8 13.7 141.8 13.9C141.8 14.2 141.6 14.3 141.4 14.2L139.8 13.4C139.6 13.3 139.5 13 139.5 12.8ZM146.2 12.7C146.4 12.8 146.5 12.9 146.6 13.1C146.7 13.3 146.8 13.5 146.8 13.6C146.8 13.8 146.7 13.9 146.6 14L146.4 14.2L145.6 12.9L145.9 12.7C146 12.7 146.1 12.7 146.2 12.7ZM145.4 13L146.2 14.3L144.5 15.5C144.4 15.6 144.2 15.6 144 15.6L143.5 15.5C143.5 15.5 143.4 15.5 143.4 15.5C143.4 15.5 143.4 15.4 143.4 15.4C143.3 15.4 143.3 15.3 143.3 15.3C143.3 15.3 143.3 15.2 143.3 15.2L143.5 14.6C143.5 14.4 143.6 14.3 143.7 14.2L145.4 13Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
      />
      <defs>
        <clipPath id="clip0_1278_188">
          <rect
            width="16.6679"
            height="16.6679"
            fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
            transform="matrix(0.866025 -0.5 0 1 73.7476 34.887)"
          />
        </clipPath>
      </defs>
    </svg>
  );
}
