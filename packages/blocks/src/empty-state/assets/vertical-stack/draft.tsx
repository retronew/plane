/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ILLUSTRATION_COLOR_TOKEN_MAP } from "../helper";

export type DraftVerticalStackIllustrationProps = {
  className?: string;
};

export function DraftVerticalStackIllustration({ className }: DraftVerticalStackIllustrationProps) {
  return (
    <svg
      width="162"
      height="175"
      viewBox="0 0 162 175"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <g opacity="0.2">
        <path
          d="M14 141C14 142.9 15.4 144.9 18.3 146.3L55.9 165.5C61.7 168.4 71.2 168.4 77 165.5L155.8 125.3C158.7 123.8 160.2 121.9 160.2 119.9V126.1C160.2 128.1 158.7 130 155.8 131.5L77 171.7C71.2 174.7 61.7 174.7 55.9 171.7L18.3 152.6C15.4 151.1 14 149.1 14 147.2V141Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M14 141C14 139 15.4 137.1 18.3 135.6L97.2 95.4C103 92.4 112.5 92.4 118.3 95.4L155.8 114.5C158.7 116 160.2 118 160.2 119.9C160.2 121.9 158.7 123.8 155.8 125.3L77 165.5C71.2 168.4 61.7 168.4 55.9 165.5L18.3 146.3C15.4 144.9 14 142.9 14 141Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <g opacity="0.6">
        <path
          d="M14 121.3C14 123.3 15.4 125.2 18.3 126.7L55.9 145.8C61.7 148.8 71.2 148.8 77 145.8L155.8 105.6C158.7 104.1 160.2 102.2 160.2 100.3V106.5C160.2 108.4 158.7 110.4 155.8 111.9L77 152C71.2 155 61.7 155 55.9 152L18.3 132.9C15.4 131.4 14 129.5 14 127.5V121.3Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M14 121.3C14 119.4 15.4 117.4 18.3 115.9L97.2 75.8C103 72.8 112.5 72.8 118.3 75.8L155.8 94.9C158.7 96.4 160.2 98.3 160.2 100.3C160.2 102.2 158.7 104.1 155.8 105.6L77 145.8C71.2 148.8 61.7 148.8 55.9 145.8L18.3 126.7C15.4 125.2 14 123.3 14 121.3Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <path
        d="M14 101.6C14 103.6 15.4 105.5 18.3 107L55.9 126.1C61.7 129.1 71.2 129.1 77 126.1L155.8 86C158.7 84.5 160.2 82.5 160.2 80.6V86.8C160.2 88.8 158.7 90.7 155.8 92.2L77 132.4C71.2 135.3 61.7 135.3 55.9 132.4L18.3 113.2C15.4 111.8 14 109.8 14 107.9V101.6Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 101.6C14 99.7 15.4 97.7 18.3 96.3L97.2 56.1C103 53.1 112.5 53.1 118.3 56.1L155.8 75.2C158.7 76.7 160.2 78.6 160.2 80.6C160.2 82.5 158.7 84.5 155.8 86L77 126.1C71.2 129.1 61.7 129.1 55.9 126.1L18.3 107C15.4 105.5 14 103.6 14 101.6Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M71.5 94.7C70.6 94.7 69.8 94.5 69 94.1L64.7 91.9C62.5 90.8 61.2 88.2 61.2 84.8V52.3C61.2 46.1 65.4 39 70.4 36.5L97.2 22.8C98.4 22.2 99.6 21.9 100.8 21.9C101.7 21.9 102.6 22.1 103.3 22.4L107.6 24.6C109.8 25.8 111.1 28.4 111.1 31.8V64.3C111.1 70.4 107 77.5 101.9 80.1L75.2 93.7C73.9 94.4 72.7 94.7 71.5 94.7Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
      />
      <path
        d="M100.8 22.4C101.6 22.4 102.4 22.6 103.1 22.9L107.4 25.1C109.3 26.1 110.6 28.4 110.6 31.8V64.3C110.6 70.3 106.6 77.2 101.7 79.7L74.9 93.3C73.7 93.9 72.6 94.2 71.5 94.2C70.7 94.2 69.9 94 69.2 93.7L64.9 91.5C63 90.5 61.7 88.1 61.7 84.8V52.3C61.7 46.3 65.7 39.4 70.6 36.9L97.4 23.3C98.6 22.7 99.8 22.4 100.8 22.4ZM100.8 21.3C99.6 21.3 98.3 21.7 96.9 22.4L70.2 36C65 38.6 60.7 45.9 60.7 52.3V84.8C60.7 88.4 62.1 91.2 64.5 92.4L68.8 94.6C69.6 95 70.5 95.2 71.5 95.2C72.8 95.2 74.1 94.9 75.4 94.2L102.2 80.6C107.4 77.9 111.6 70.6 111.6 64.3V31.8C111.6 28.2 110.2 25.4 107.9 24.2L103.6 22C102.7 21.6 101.8 21.3 100.8 21.3Z"
        fill="var(--illustration-stroke-tertiary)"
      />
      <path
        d="M107.4 25.1C105.9 24.3 103.9 24.4 101.7 25.5L74.9 39.1C70 41.6 66.1 48.5 66.1 54.5V87C66.1 90.3 67.3 92.7 69.2 93.7L64.9 91.5C63 90.5 61.7 88.1 61.7 84.8V52.3C61.7 46.3 65.7 39.4 70.6 36.9L97.4 23.3C99.6 22.2 101.5 22.1 103.1 22.9L107.4 25.1Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.tertiary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M107.4 25.1C109.3 26.1 110.6 28.4 110.6 31.8V64.3C110.6 70.3 106.6 77.2 101.7 79.7L74.9 93.3C72.8 94.4 70.8 94.5 69.2 93.7C67.3 92.7 66.1 90.3 66.1 87V54.5C66.1 48.5 70 41.6 74.9 39.1L101.7 25.5C103.9 24.4 105.9 24.3 107.4 25.1Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M124.7 22.7C124.6 22.7 124.5 22.7 124.5 22.6L119.6 20.2C119.6 20.2 119.6 20.2 119.6 20.1L111.2 14.2C111 14.1 111 13.8 111.1 13.6L113.7 9.1C114.9 7.1 116.4 5.5 118.1 4.6C118.9 4.2 119.8 4 120.6 4C121.2 4 121.8 4.1 122.3 4.4L127.2 6.8C127.3 6.9 127.5 7 127.6 7.1C128.8 8 129.5 9.6 129.5 11.7C129.5 13.8 128.9 15.9 127.7 17.9L125.1 22.4C125 22.6 124.9 22.7 124.7 22.7L124.7 22.7Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
      />
      <path
        d="M120.6 4.5C121.1 4.5 121.6 4.6 122.1 4.8L126.9 7.3C127 7.4 127.2 7.4 127.3 7.5C128.4 8.3 129 9.8 129 11.7C129 13.6 128.4 15.8 127.3 17.7L124.7 22.2L119.9 19.7L111.5 13.8L114.1 9.3C115.2 7.4 116.7 5.9 118.3 5.1C119.1 4.7 119.9 4.5 120.6 4.5ZM120.6 3.5C119.7 3.5 118.8 3.7 117.8 4.2C116.1 5.1 114.5 6.7 113.2 8.8L110.6 13.3C110.4 13.8 110.5 14.3 110.9 14.7L119.3 20.6C119.3 20.6 119.4 20.6 119.4 20.6L124.2 23.1C124.4 23.2 124.5 23.2 124.7 23.2C125.1 23.2 125.4 23 125.6 22.7L128.2 18.2C129.4 16.1 130.1 13.8 130.1 11.7C130.1 9.5 129.3 7.7 127.9 6.7C127.7 6.6 127.6 6.5 127.4 6.4L122.6 3.9C122 3.6 121.3 3.5 120.6 3.5Z"
        fill="var(--illustration-stroke-tertiary)"
      />
      <path
        d="M91.3 71.3C91 71.3 90.8 71.3 90.6 71.2C90.6 71.2 90.5 71.1 90.5 71.1L85.7 68.7C85.7 68.7 85.6 68.6 85.6 68.6C85.3 68.4 85.1 68 85 67.6C84.9 67.2 84.9 66.7 85 66.3L86.8 58C87.4 55.4 88.4 52.7 89.8 50.3L108.7 17.7C108.8 17.5 109 17.4 109.1 17.4C109.2 17.4 109.3 17.4 109.4 17.5L114.2 19.9C114.2 19.9 114.2 20 114.3 20L122.6 25.9C122.8 26 122.9 26.3 122.8 26.5L115.7 38.7L103.9 59.2C102.5 61.6 100.7 63.8 98.8 65.4L92.7 70.7C92.4 71 92 71.2 91.6 71.3C91.5 71.3 91.4 71.3 91.3 71.3V71.3Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
      />
      <path
        d="M109.1 17.9L114 20.4L122.3 26.3L115.3 38.4L110.5 46.6L103.4 58.9C102 61.3 100.3 63.4 98.4 65L92.4 70.3C92.1 70.6 91.8 70.7 91.5 70.8C91.4 70.8 91.3 70.8 91.3 70.8C91.1 70.8 91 70.8 90.8 70.7C90.8 70.7 90.8 70.7 90.7 70.7L85.9 68.2C85.7 68 85.5 67.8 85.5 67.5C85.4 67.2 85.4 66.8 85.5 66.4L87.3 58.1C87.8 55.5 88.9 52.9 90.3 50.5L109.1 17.9ZM109.1 16.9C108.8 16.9 108.4 17.1 108.3 17.4L89.4 50C87.9 52.5 86.9 55.2 86.3 57.9L84.5 66.2C84.4 66.7 84.4 67.2 84.5 67.7C84.6 68.3 84.9 68.7 85.3 69C85.4 69.1 85.4 69.1 85.4 69.1L90.2 71.6C90.3 71.6 90.3 71.6 90.4 71.7C90.7 71.8 91 71.9 91.3 71.9C91.4 71.9 91.6 71.8 91.7 71.8C92.2 71.7 92.7 71.5 93.1 71.1L99.1 65.8C101.1 64.1 102.9 61.9 104.3 59.4L111.4 47.1L116.2 39L123.2 26.8C123.5 26.4 123.3 25.8 122.9 25.5L114.6 19.6C114.5 19.5 114.5 19.5 114.4 19.5L109.6 17C109.5 16.9 109.3 16.9 109.1 16.9V16.9Z"
        fill="var(--illustration-stroke-tertiary)"
      />
      <path
        d="M126.9 7.3C125.9 6.8 124.5 6.8 123.1 7.5C121.6 8.3 120.1 9.9 119 11.8L116.4 16.3L111.5 13.8L114.1 9.3C115.2 7.4 116.7 5.9 118.3 5.1C119.7 4.4 121 4.3 122.1 4.8L126.9 7.3Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.tertiary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M116.4 16.3L124.7 22.2L119.9 19.7L111.5 13.8L116.4 16.3Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.tertiary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M126.9 7.3C127 7.4 127.2 7.4 127.3 7.5C128.4 8.3 129 9.8 129 11.7C129 13.6 128.4 15.8 127.3 17.7L124.7 22.2L116.4 16.3L119 11.8C120.1 9.9 121.6 8.3 123.1 7.5C124.5 6.8 125.9 6.8 126.9 7.3Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M114 20.4L95.1 53C93.7 55.4 92.7 58 92.1 60.6L90.3 68.8C90.2 69.2 90.2 69.6 90.3 69.9C90.4 70.2 90.5 70.5 90.7 70.7L85.9 68.2C85.7 68 85.5 67.8 85.5 67.5C85.4 67.2 85.4 66.8 85.5 66.4L87.3 58.1C87.8 55.5 88.9 52.9 90.3 50.5L109.1 17.9L114 20.4Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.tertiary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M114 20.4L122.3 26.3L103.4 58.9C102 61.3 100.3 63.4 98.4 65L92.4 70.3C92.1 70.6 91.8 70.7 91.5 70.8C91.3 70.8 91 70.8 90.8 70.7C90.8 70.7 90.8 70.7 90.7 70.7C90.5 70.5 90.4 70.2 90.3 69.9C90.2 69.6 90.2 69.2 90.3 68.8L92.1 60.6C92.7 58 93.7 55.4 95.1 53L114 20.4Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M146.1 37.3C147.3 36.8 148.7 36.8 150.3 37.6C153.9 39.4 156.8 44.4 156.8 48.8C156.8 51.2 155.9 52.9 154.4 53.6L156.7 52.5C158.2 51.7 159.1 50 159.1 47.6C159.1 43.3 156.2 38.3 152.6 36.4C151 35.6 149.6 35.6 148.4 36.2L146.1 37.3Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M146.1 37.3C144.7 38.1 143.8 39.8 143.8 42.2C143.8 46.5 146.7 51.5 150.3 53.4C151.9 54.2 153.3 54.2 154.4 53.6C155.9 52.9 156.8 51.2 156.8 48.8C156.8 44.4 153.9 39.4 150.3 37.6C148.7 36.8 147.3 36.8 146.1 37.3Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M152.1 43.6C151.9 43.3 151.6 43 151.4 42.9C151.1 42.8 150.9 42.8 150.7 42.9L148 44.9C147.7 45.1 147.5 45.5 147.5 46C147.5 46.5 147.7 47.1 148 47.6C148.3 48.1 148.7 48.5 149.1 48.7C149.5 49 149.9 49 150.2 48.8L153.2 46.7C153.3 46.6 153.5 46.7 153.6 46.9C153.7 47.1 153.7 47.4 153.6 47.5L150.7 49.5C150.3 49.8 149.7 49.8 149.1 49.5C148.5 49.2 147.9 48.7 147.5 47.9C147.1 47.2 146.9 46.4 146.9 45.7C146.9 44.9 147.1 44.4 147.5 44.1L150.2 42.1C150.5 41.9 151 41.9 151.4 42.1C151.8 42.4 152.2 42.8 152.5 43.3C152.8 43.8 153 44.4 153 44.9C153 45.4 152.8 45.8 152.5 46L149.8 48C149.6 48.1 149.3 48.1 149.1 48C148.8 47.9 148.6 47.6 148.4 47.3C148.2 47 148.1 46.6 148.1 46.3C148.1 46 148.2 45.8 148.4 45.6L151.1 43.7C151.2 43.6 151.4 43.7 151.6 44C151.7 44.2 151.7 44.4 151.6 44.5L148.9 46.4C148.8 46.5 148.8 46.5 148.8 46.6C148.8 46.7 148.8 46.9 148.9 47C148.9 47.1 149 47.2 149.1 47.2C149.2 47.2 149.3 47.2 149.3 47.2L152.1 45.3C152.2 45.1 152.3 44.9 152.3 44.6C152.3 44.3 152.2 43.9 152.1 43.6L152.1 43.6Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M23 37.5C22.4 37.2 22.1 36.5 22.1 35.5V22.9C22.1 21.1 23.3 19.1 24.7 18.3L57.4 1.6C58.1 1.3 58.7 1.3 59.1 1.5L56.8 0.4C56.4 0.1 55.8 0.1 55.1 0.5L22.4 17.1C21 17.9 19.8 19.9 19.8 21.7V34.3C19.8 35.3 20.1 36 20.7 36.3L23 37.5Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M23 37.5C23.5 37.7 24.1 37.7 24.7 37.4L57.4 20.7C58.9 20 60.1 17.9 60.1 16.2V3.5C60.1 2.5 59.7 1.8 59.1 1.5C58.7 1.3 58.1 1.3 57.4 1.6L24.7 18.3C23.3 19.1 22.1 21.1 22.1 22.9V35.5C22.1 36.5 22.4 37.2 23 37.5Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M46.7 15.2L39.1 19.1C38.5 19.4 38 19 38 18.3C38 17.5 38.5 16.6 39.1 16.3L46.7 12.5C47.3 12.1 47.8 12.5 47.8 13.3C47.8 14 47.3 14.9 46.7 15.2Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M50.2 19.8L39.6 25.2C38.7 25.6 38 25.1 38 24.1C38 23 38.7 21.8 39.6 21.4L50.2 15.9C51.1 15.5 51.8 16 51.8 17C51.8 18.1 51.1 19.3 50.2 19.8Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M30.7 23.3C30.7 23.4 30.9 23.5 31 23.4C31.3 23.3 31.5 22.9 31.5 22.7V22.1C31.5 21.9 31.4 21.8 31.3 21.8C31.2 21.7 31 21.8 30.9 21.9L28.2 24.6C28 24.8 27.9 25 27.9 25.2V28.9C27.9 29.1 28 29.2 28.1 29.3C28.2 29.3 28.4 29.2 28.5 29.1L28.9 28.6C29.1 28.4 29.2 28 29.1 27.8C29 27.7 28.9 27.7 28.7 27.7V25.2L30.7 23.3L30.7 23.3Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M29 22.5C29 22.7 29.2 22.8 29.4 22.7C29.6 22.5 29.8 22.2 29.8 21.9V21.4C29.8 21.2 29.7 21.1 29.6 21C29.5 21 29.3 21.1 29.2 21.2L26.5 23.9C26.3 24.1 26.2 24.3 26.2 24.5V28.2C26.2 28.4 26.3 28.5 26.4 28.6C26.5 28.6 26.7 28.5 26.8 28.4L27.2 27.9C27.4 27.7 27.5 27.3 27.4 27.1C27.3 27 27.2 26.9 27.1 27V24.5L29 22.5L29 22.5Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M33.3 26.4C33.3 26.6 33.2 26.9 33.1 27L30.3 29.7C30.2 29.9 30.1 29.9 29.9 29.9C29.8 29.8 29.8 29.7 29.8 29.5V25.9C29.8 25.6 29.9 25.4 30 25.2L32.8 22.5C32.9 22.4 33 22.3 33.1 22.4C33.3 22.4 33.3 22.6 33.3 22.7V26.4V26.4ZM32.5 23.9L30.6 25.8V28.4L32.5 26.5V23.9V23.9Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M4.8 81C3.4 80.3 2.5 78.6 2.5 76.2C2.5 71.8 5.4 66.8 9 65L32.9 52.8C34.5 52 35.9 52 37 52.5L34.7 51.4C33.6 50.8 32.2 50.8 30.6 51.6L6.7 63.8C3.1 65.6 0.2 70.7 0.2 75C0.2 77.4 1.1 79.1 2.5 79.9L4.8 81Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M4.8 81C5.9 81.6 7.4 81.5 9 80.7L32.9 68.5C36.5 66.7 39.4 61.7 39.4 57.4C39.4 55 38.5 53.2 37 52.5C35.9 52 34.5 52 32.9 52.8L9 65C5.4 66.8 2.5 71.8 2.5 76.2C2.5 78.6 3.4 80.3 4.8 81Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M29.9 64.9L21.1 69.4C20.4 69.8 19.8 69.3 19.8 68.5C19.8 67.6 20.4 66.6 21.1 66.2L29.9 61.8C30.6 61.4 31.2 61.8 31.2 62.7C31.2 63.6 30.6 64.6 29.9 64.9Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9.1 73.5C8.8 73.9 8.7 74.4 8.7 74.9C8.7 75.3 8.8 75.6 9.1 75.8C9.3 76 9.7 76 10 75.8C10.4 75.6 10.7 75.3 11 74.9L11.4 74C11.6 73.8 11.8 73.7 11.9 73.8C12 73.9 12 74.1 11.9 74.4L11.4 75.2C11.1 75.8 10.6 76.3 10 76.6C9.5 76.9 9 76.9 8.6 76.6C8.2 76.4 8 75.9 8 75.2C8 74.6 8.2 73.8 8.6 73.2L9.1 72.4C9.2 72.1 9.4 72 9.5 72.1C9.7 72.2 9.7 72.5 9.5 72.7L9.1 73.5V73.5Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10.5 70.5C10.4 70.4 10.4 70.2 10.5 69.9L11 69.1C11.3 68.5 11.8 68 12.4 67.7C12.9 67.4 13.4 67.4 13.8 67.7C14.2 67.9 14.4 68.5 14.4 69.1C14.4 69.7 14.2 70.5 13.8 71.1L13.3 71.9C13.2 72.2 13 72.3 12.8 72.2C12.7 72.1 12.7 71.8 12.8 71.6L13.3 70.8C13.6 70.4 13.7 69.9 13.7 69.4C13.7 69 13.6 68.7 13.3 68.5C13.1 68.3 12.7 68.3 12.4 68.5C12 68.7 11.7 69 11.4 69.4L11 70.3C10.8 70.5 10.6 70.6 10.5 70.5V70.5Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10 74.2C9.9 74.1 9.9 73.8 10 73.6L11.9 70.4C12 70.1 12.2 70 12.4 70.1C12.5 70.2 12.5 70.5 12.4 70.7L10.5 73.9C10.4 74.2 10.1 74.3 10 74.2Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
    </svg>
  );
}
