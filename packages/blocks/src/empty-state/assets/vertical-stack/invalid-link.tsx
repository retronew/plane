/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ILLUSTRATION_COLOR_TOKEN_MAP } from "../helper";

export type InvalidLinkVerticalStackIllustrationProps = {
  className?: string;
};

export function InvalidLinkVerticalStackIllustration({ className }: InvalidLinkVerticalStackIllustrationProps) {
  return (
    <svg
      width="161"
      height="151"
      viewBox="0 0 161 151"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <g opacity="0.2">
        <path
          d="M0.3 113.6C0.3 115.7 1.8 117.8 5 119.5L46.1 140.4C52.5 143.6 62.8 143.6 69.2 140.4L155.5 96.4C158.7 94.8 160.3 92.7 160.3 90.5V97.4C160.3 99.5 158.7 101.6 155.5 103.2L69.2 147.2C62.8 150.5 52.5 150.5 46.1 147.2L5 126.3C1.8 124.7 0.3 122.5 0.3 120.4V113.6Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M0.3 113.6C0.3 111.4 1.8 109.3 5 107.7L91.3 63.7C97.7 60.5 108 60.5 114.4 63.7L155.5 84.7C158.7 86.3 160.3 88.4 160.3 90.5C160.3 92.7 158.7 94.8 155.5 96.4L69.2 140.4C62.8 143.6 52.5 143.6 46.1 140.4L5 119.5C1.8 117.8 0.3 115.7 0.3 113.6Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <g opacity="0.6">
        <path
          d="M0.3 92.1C0.3 94.2 1.8 96.3 5 98L46.1 118.9C52.5 122.1 62.8 122.1 69.2 118.9L155.5 74.9C158.7 73.3 160.3 71.2 160.3 69V75.8C160.3 78 158.7 80.1 155.5 81.7L69.2 125.7C62.8 128.9 52.5 128.9 46.1 125.7L5 104.8C1.8 103.1 0.3 101 0.3 98.9V92.1Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M0.3 92.1C0.3 89.9 1.8 87.8 5 86.2L91.3 42.2C97.7 39 108 39 114.4 42.2L155.5 63.1C158.7 64.8 160.3 66.9 160.3 69C160.3 71.2 158.7 73.3 155.5 74.9L69.2 118.9C62.8 122.1 52.5 122.1 46.1 118.9L5 98C1.8 96.3 0.3 94.2 0.3 92.1Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <path
        d="M0.3 70.5C0.3 72.7 1.8 74.8 5 76.4L46.1 97.4C52.5 100.6 62.8 100.6 69.2 97.4L155.5 53.4C158.7 51.8 160.3 49.6 160.3 47.5V54.3C160.3 56.5 158.7 58.6 155.5 60.2L69.2 104.2C62.8 107.4 52.5 107.4 46.1 104.2L5 83.2C1.8 81.6 0.3 79.5 0.3 77.4V70.5Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M0.3 70.5C0.3 68.4 1.8 66.3 5 64.7L91.3 20.7C97.7 17.5 108 17.5 114.4 20.7L155.5 41.6C158.7 43.2 160.3 45.4 160.3 47.5C160.3 49.6 158.7 51.8 155.5 53.4L69.2 97.4C62.8 100.6 52.5 100.6 46.1 97.4L5 76.4C1.8 74.8 0.3 72.7 0.3 70.5Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M110.3 39.7C110 39.7 109.7 39.7 109.4 39.6C109.4 39.6 109.3 39.5 109.3 39.5L104.2 36.9C102.6 36.1 102.3 33.6 103.5 31.1C105.1 27.7 106 24 106 20.7C106 17.7 105.3 15.2 103.9 13.5C103.8 13.5 103.8 13.5 103.7 13.5C102.2 13.5 100.6 13.9 99 14.7L92.6 18C92.1 18.3 91.6 18.4 91.1 18.4C90.7 18.4 90.4 18.3 90 18.1L85 15.6C84.1 15.1 83.6 14 83.6 12.7C83.6 10.3 85.1 7.6 87.1 6.6L93.5 3.4C96.1 2 98.7 1.3 101.1 1.3C103 1.3 104.7 1.8 106.3 2.6L111.3 5.1C115.9 7.4 118.5 12.9 118.5 20C118.5 25.1 117.1 30.9 114.6 36.2C114 37.7 112.9 38.8 111.8 39.4C111.3 39.6 110.8 39.8 110.3 39.8V39.7Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
      />
      <path
        d="M101.1 1.9C102.9 1.9 104.6 2.3 106.1 3L111.1 5.6C115.3 7.8 118 12.8 118 20C118 25 116.6 30.7 114.1 36C113.5 37.3 112.5 38.4 111.6 38.9C111.1 39.1 110.7 39.2 110.3 39.2C110.1 39.2 109.9 39.1 109.6 39.1C109.6 39 109.6 39 109.5 39L104.5 36.4C103.2 35.8 102.9 33.5 104 31.4C105.6 27.8 106.5 24.1 106.5 20.7C106.5 17.4 105.7 14.7 104.2 12.9C104 12.9 103.9 12.9 103.7 12.9C102.2 12.9 100.5 13.3 98.8 14.2L92.4 17.5C91.9 17.7 91.5 17.8 91.1 17.8C90.8 17.8 90.6 17.7 90.3 17.6L85.3 15.1C84.6 14.7 84.1 13.8 84.1 12.7C84.1 10.5 85.6 8 87.3 7.1L93.7 3.9C96.4 2.5 98.9 1.9 101.1 1.9M101.1 0.8C98.6 0.8 95.9 1.5 93.2 2.9L86.8 6.1C84.7 7.2 83 10.1 83 12.7C83 14.3 83.7 15.5 84.8 16.1L89.8 18.6C90.2 18.8 90.7 18.9 91.1 18.9C91.7 18.9 92.3 18.8 92.9 18.5L99.3 15.2C100.8 14.5 102.3 14.1 103.6 14C104.8 15.7 105.4 18 105.4 20.7C105.4 23.9 104.5 27.5 103 30.9C101.7 33.7 102.1 36.5 104 37.4L109 40C109.1 40 109.2 40.1 109.2 40.1C109.6 40.2 110 40.3 110.3 40.3C110.9 40.3 111.5 40.2 112.1 39.9C113.3 39.2 114.4 38 115.1 36.5C117.7 31 119.1 25.2 119.1 20C119.1 12.7 116.4 7 111.6 4.6L106.6 2C104.9 1.2 103.1 0.8 101.1 0.8H101.1Z"
        fill="var(--illustration-stroke-tertiary)"
      />
      <path
        d="M59.4 72C57.5 72 55.8 71.6 54.2 70.8L49.2 68.2C44.6 65.9 42 60.5 42 53.3C42 40.2 50.7 25.2 61.5 19.7C62 19.4 62.5 19.3 63 19.3C63.4 19.3 63.7 19.4 64.1 19.5L69.1 22.1C70 22.6 70.5 23.6 70.5 25C70.5 27.4 69 30 67 31C60.1 34.5 54.5 44.2 54.5 52.6C54.5 55.6 55.2 58.1 56.6 59.9C56.7 59.9 56.7 59.9 56.8 59.9C58.3 59.9 59.9 59.4 61.5 58.6L67.9 55.4C68.4 55.1 68.9 55 69.4 55C69.8 55 70.1 55 70.5 55.2L75.5 57.8C76.4 58.2 76.9 59.3 76.9 60.7C76.9 63.1 75.4 65.7 73.4 66.7L67 70C64.4 71.3 61.8 72 59.4 72Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
      />
      <path
        d="M63 19.9C63.3 19.9 63.5 19.9 63.8 20L68.8 22.6C69.5 23 70 23.8 70 25C70 27.2 68.5 29.6 66.8 30.5C59.7 34.1 54 44 54 52.6C54 56 54.8 58.6 56.3 60.4C56.5 60.4 56.7 60.4 56.8 60.4C58.3 60.4 60 60 61.7 59.1L68.1 55.9C68.6 55.6 69 55.5 69.4 55.5C69.7 55.5 70 55.6 70.2 55.7L75.2 58.3C75.9 58.6 76.4 59.5 76.4 60.7C76.4 62.8 74.9 65.3 73.2 66.2L66.8 69.5C64.2 70.8 61.7 71.4 59.4 71.4C57.6 71.4 55.9 71 54.5 70.3L49.4 67.7C45.2 65.6 42.6 60.5 42.6 53.3C42.6 40.4 51.2 25.6 61.7 20.2C62.2 20 62.6 19.9 63 19.9M63 18.7C62.4 18.7 61.8 18.9 61.2 19.2C50.3 24.7 41.4 40.1 41.4 53.3C41.4 60.7 44.1 66.3 48.9 68.7L53.9 71.3C55.6 72.1 57.4 72.6 59.4 72.6C61.9 72.6 64.6 71.9 67.3 70.5L73.7 67.2C75.8 66.1 77.5 63.3 77.5 60.7C77.5 59.1 76.9 57.8 75.7 57.3L70.7 54.7C70.3 54.5 69.9 54.4 69.4 54.4C68.8 54.4 68.2 54.6 67.6 54.9L61.2 58.1C59.7 58.9 58.2 59.3 56.9 59.3C55.7 57.7 55.1 55.4 55.1 52.6C55.1 44.4 60.6 35 67.3 31.5C69.4 30.4 71.1 27.6 71.1 25C71.1 23.4 70.5 22.2 69.3 21.6L64.3 19C63.9 18.8 63.4 18.7 63 18.7L63 18.7Z"
        fill="var(--illustration-stroke-tertiary)"
      />
      <path
        d="M68.7 49.3C68.3 49.3 68 49.2 67.7 49L62.6 46.4C61.7 46 61.2 44.9 61.2 43.5C61.2 41.2 62.7 38.5 64.7 37.5L77.5 31C78 30.7 78.5 30.6 79 30.6C79.4 30.6 79.7 30.7 80.1 30.9L85.1 33.4C86 33.9 86.5 34.9 86.5 36.3C86.5 38.7 85 41.3 83 42.3L70.2 48.9C69.7 49.1 69.2 49.3 68.7 49.3Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
      />
      <path
        d="M79 31.2C79.3 31.2 79.5 31.2 79.8 31.4L84.8 33.9C85.5 34.3 86 35.1 86 36.3C86 38.5 84.5 40.9 82.8 41.8L70 48.4C69.5 48.6 69.1 48.7 68.7 48.7C68.4 48.7 68.2 48.6 67.9 48.5L62.9 45.9C62.2 45.6 61.7 44.7 61.7 43.5C61.7 41.4 63.2 38.9 64.9 38L77.7 31.5C78.2 31.3 78.6 31.2 79 31.2ZM79 30C78.4 30 77.8 30.2 77.2 30.5L64.4 37C62.3 38.1 60.6 41 60.6 43.5C60.6 45.1 61.3 46.4 62.4 47L67.4 49.5C67.8 49.7 68.3 49.8 68.7 49.8C69.3 49.8 69.9 49.7 70.5 49.4L83.3 42.9C85.4 41.8 87.1 38.9 87.1 36.3C87.1 34.7 86.5 33.5 85.3 32.9L80.3 30.4C79.9 30.1 79.5 30 79 30Z"
        fill="var(--illustration-stroke-tertiary)"
      />
      <path
        d="M107 13.7C109.8 15.1 111.6 18.5 111.6 23.3C111.6 26.6 110.7 30.4 109 33.9C108 36.1 108.2 38.3 109.5 39L104.5 36.4C103.2 35.8 102.9 33.6 104 31.4C105.6 27.8 106.5 24.1 106.5 20.7C106.5 15.9 104.7 12.5 101.9 11.1L107 13.7Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M111.1 5.6C107.7 3.9 103.5 4.1 98.8 6.4L92.4 9.7C90.6 10.6 89.2 13.1 89.2 15.2C89.2 16.4 89.6 17.3 90.3 17.6L85.3 15.1C84.6 14.7 84.1 13.9 84.1 12.7C84.1 10.5 85.6 8 87.3 7.1L93.7 3.9C98.4 1.5 102.7 1.4 106.1 3.1L111.1 5.6Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M111.1 5.6C115.3 7.8 118 12.8 118 20C118 25 116.6 30.7 114.1 36C113.5 37.3 112.5 38.4 111.6 38.9C110.9 39.2 110.2 39.3 109.6 39.1C109.6 39 109.6 39 109.5 39C108.2 38.3 108 36.1 109 33.9C110.7 30.4 111.6 26.6 111.6 23.3C111.6 18.5 109.8 15.1 107 13.7C104.7 12.5 101.9 12.6 98.8 14.2L92.4 17.5C91.6 17.9 90.9 17.9 90.3 17.6C89.6 17.3 89.2 16.4 89.2 15.2C89.2 13.1 90.6 10.6 92.4 9.7L98.8 6.4C103.4 4 107.7 3.9 111.1 5.6L111.1 5.6Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M75.2 58.3C74.7 58 73.9 58 73.2 58.4L66.8 61.7C63.6 63.3 60.8 63.4 58.6 62.2L53.5 59.7C55.8 60.8 58.6 60.7 61.7 59.1L68.1 55.9C68.9 55.5 69.6 55.4 70.2 55.7L75.2 58.3Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M68.8 22.6C68.3 22.3 67.5 22.3 66.8 22.7C56.2 28.1 47.6 43 47.6 55.9C47.6 63.1 50.2 68.2 54.5 70.3L49.4 67.7C45.2 65.6 42.5 60.5 42.5 53.3C42.5 40.4 51.2 25.6 61.7 20.2C62.5 19.8 63.2 19.8 63.8 20L68.8 22.6Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M68.8 22.6C69.5 23 70 23.8 70 25C70 27.2 68.5 29.6 66.8 30.5C59.7 34.1 54 44 54 52.6C54 57.4 55.8 60.8 58.6 62.2C60.8 63.4 63.7 63.3 66.8 61.7L73.2 58.4C74 58 74.7 58 75.2 58.3C75.9 58.6 76.4 59.5 76.4 60.7C76.4 62.8 74.9 65.3 73.2 66.2L66.8 69.5C62.1 71.9 57.8 72 54.5 70.3C50.3 68.2 47.6 63.1 47.6 55.9C47.6 43 56.2 28.1 66.8 22.7C67.6 22.3 68.3 22.3 68.8 22.6H68.8Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M84.8 33.9C84.3 33.6 83.5 33.7 82.8 34.1L70 40.6C68.2 41.5 66.8 44 66.8 46.1C66.8 47.3 67.2 48.1 67.9 48.5L62.9 45.9C62.2 45.6 61.7 44.7 61.7 43.5C61.7 41.4 63.2 38.9 64.9 38L77.7 31.5C78.5 31.1 79.2 31.1 79.8 31.4L84.8 33.9Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M84.8 33.9C85.5 34.3 86 35.1 86 36.3C86 38.5 84.5 40.9 82.8 41.8L70 48.4C69.2 48.8 68.5 48.8 67.9 48.5C67.2 48.1 66.8 47.3 66.8 46.1C66.8 44 68.2 41.5 70 40.6L82.8 34.1C83.5 33.7 84.3 33.6 84.8 33.9Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M111 58C110.6 58 110.3 57.9 109.9 57.7L104.9 55.2C104.8 55.1 104.7 55 104.6 55L40.6 9.7C39.1 8.6 39.1 5.9 40.5 3.5C41.5 1.7 43.1 0.6 44.5 0.6C44.8 0.6 45.2 0.6 45.5 0.8L50.6 3.4C50.7 3.4 50.8 3.5 50.8 3.5L114.8 48.8C116.3 49.9 116.4 52.6 115 55.1C114.3 56.2 113.5 57.1 112.5 57.6C112 57.8 111.5 58 111 58Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
      />
      <path
        d="M44.5 1.1C44.8 1.1 45 1.2 45.3 1.3L50.3 3.9C50.4 3.9 50.5 4 50.5 4L114.5 49.3C115.8 50.2 115.8 52.6 114.5 54.8C113.9 55.9 113.1 56.7 112.3 57.1C111.8 57.3 111.4 57.4 111 57.4C110.7 57.4 110.4 57.3 110.2 57.2L105.2 54.6C105.1 54.6 105 54.6 105 54.5L41 9.3C39.7 8.4 39.7 5.9 41 3.7C41.9 2.1 43.3 1.1 44.5 1.1ZM44.5 0C42.8 0 41.1 1.2 40 3.2C38.4 5.9 38.6 8.9 40.3 10.2L104.3 55.4C104.4 55.5 104.5 55.6 104.7 55.7L109.7 58.2C110.1 58.4 110.5 58.5 111 58.5C111.6 58.5 112.2 58.4 112.8 58.1C113.8 57.5 114.8 56.6 115.5 55.3C117.1 52.7 116.9 49.6 115.2 48.4L51.2 3.1C51.1 3 50.9 2.9 50.8 2.9L45.8 0.3C45.4 0.1 44.9 0 44.5 0V0Z"
        fill="var(--illustration-stroke-tertiary)"
      />
      <path
        d="M50.3 3.9C49.1 3.2 47.2 4.3 46 6.3C44.7 8.5 44.7 10.9 46 11.8L110 57.1C110.1 57.1 110.1 57.2 110.2 57.2L105.2 54.7C105.1 54.6 105 54.6 105 54.5L41 9.3C39.7 8.4 39.7 5.9 41 3.8C42.1 1.7 44 0.7 45.3 1.3L50.3 3.9Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M50.3 3.9C50.4 3.9 50.5 4 50.5 4L114.5 49.3C115.8 50.2 115.8 52.6 114.5 54.8C113.9 55.9 113.1 56.7 112.3 57.1C111.5 57.4 110.8 57.5 110.2 57.2C110.1 57.2 110.1 57.1 110 57.1L46 11.8C44.7 10.9 44.7 8.5 46 6.3C47.2 4.3 49.1 3.2 50.3 3.9V3.9Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
