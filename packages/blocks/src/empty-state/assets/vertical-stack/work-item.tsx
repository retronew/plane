/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ILLUSTRATION_COLOR_TOKEN_MAP } from "../helper";

export type WorkItemVerticalStackIllustrationProps = {
  className?: string;
};

export function WorkItemVerticalStackIllustration({ className }: WorkItemVerticalStackIllustrationProps) {
  return (
    <svg
      width="162"
      height="180"
      viewBox="0 0 162 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <g opacity="0.2">
        <path
          d="M0.2 143.5C0.2 145.6 1.8 147.7 5 149.4L46 170.3C52.4 173.5 62.8 173.5 69.1 170.3L155.4 126.3C158.6 124.7 160.2 122.6 160.2 120.4V127.3C160.2 129.4 158.6 131.5 155.4 133.1L69.1 177.1C62.8 180.3 52.4 180.3 46 177.1L5 156.2C1.8 154.5 0.2 152.4 0.2 150.3V143.5Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M0.2 143.5C0.2 141.3 1.8 139.2 5 137.6L91.3 93.6C97.6 90.4 108 90.4 114.4 93.6L155.4 114.5C158.6 116.2 160.2 118.3 160.2 120.4C160.2 122.6 158.6 124.7 155.4 126.3L69.1 170.3C62.8 173.5 52.4 173.5 46 170.3L5 149.4C1.8 147.7 0.2 145.6 0.2 143.5Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <g opacity="0.6">
        <path
          d="M0.2 122C0.2 124.1 1.8 126.2 5 127.8L46 148.8C52.4 152 62.8 152 69.1 148.8L155.4 104.8C158.6 103.2 160.2 101.1 160.2 98.9V105.7C160.2 107.9 158.6 110 155.4 111.6L69.1 155.6C62.8 158.8 52.4 158.8 46 155.6L5 134.7C1.8 133 0.2 130.9 0.2 128.8V122Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M0.2 122C0.2 119.8 1.8 117.7 5 116.1L91.3 72.1C97.6 68.9 108 68.9 114.4 72.1L155.4 93C158.6 94.7 160.2 96.8 160.2 98.9C160.2 101.1 158.6 103.2 155.4 104.8L69.1 148.8C62.8 152 52.4 152 46 148.8L5 127.8C1.8 126.2 0.2 124.1 0.2 122Z"
          fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
          stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
          strokeWidth="0.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <path
        d="M0.2 100.4C0.2 102.6 1.8 104.7 5 106.3L46 127.2C52.4 130.5 62.8 130.5 69.1 127.2L155.4 83.3C158.6 81.7 160.2 79.5 160.2 77.4V84.2C160.2 86.3 158.6 88.5 155.4 90.1L69.1 134.1C62.8 137.3 52.4 137.3 46 134.1L5 113.1C1.8 111.5 0.2 109.4 0.2 107.2V100.4Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M0.2 100.4C0.2 98.3 1.8 96.2 5 94.5L91.3 50.6C97.6 47.3 108 47.3 114.4 50.6L155.4 71.5C158.6 73.1 160.2 75.3 160.2 77.4C160.2 79.5 158.6 81.7 155.4 83.3L69.1 127.2C62.8 130.5 52.4 130.5 46 127.2L5 106.3C1.8 104.7 0.2 102.6 0.2 100.4Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M17.1 23.7C15.9 23 14.3 23.1 12.5 24C8.6 26 5.5 31.4 5.5 36.2C5.5 38.8 6.5 40.7 8 41.5L5.5 40.2C3.9 39.4 3 37.6 3 34.9C3 30.2 6.1 24.7 10 22.7C11.8 21.8 13.3 21.8 14.6 22.4L17.1 23.7Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M17.1 23.7C18.6 24.5 19.6 26.3 19.6 29C19.6 33.7 16.5 39.2 12.6 41.2C10.8 42.1 9.2 42.1 8 41.5C6.5 40.7 5.5 38.8 5.5 36.2C5.5 31.4 8.6 26 12.5 24C14.3 23.1 15.9 23 17.1 23.7Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M13 29C11.1 30 9.6 32.6 9.6 34.9C9.6 37.1 11.1 38.2 13 37.2C14.8 36.3 16.3 33.7 16.3 31.4C16.3 29.2 14.8 28.1 13 29ZM8.9 35.3C8.9 32.5 10.7 29.3 13 28.1C15.2 27 17.1 28.3 17.1 31.1C17.1 33.8 15.2 37 13 38.2C10.7 39.3 8.9 38 8.9 35.3Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M13 30.9C11.9 31.4 11.1 32.8 11.1 34.1C11.1 35.4 11.9 36 13 35.4C14 34.9 14.8 33.5 14.8 32.2C14.8 30.9 14 30.3 13 30.9ZM10.3 34.5C10.3 32.7 11.5 30.7 13 30C14.4 29.2 15.6 30.1 15.6 31.8C15.6 33.6 14.4 35.6 13 36.3C11.5 37.1 10.3 36.3 10.3 34.5Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M146.4 33.1C147.9 32.3 148.9 30.4 148.9 27.8C148.9 23 145.7 17.5 141.8 15.6L115.6 2.2C113.9 1.3 112.3 1.3 111.1 1.9L113.6 0.6C114.8 -0 116.4 0 118.1 0.9L144.3 14.3C148.2 16.3 151.4 21.7 151.4 26.5C151.4 29.1 150.4 31 148.9 31.8L146.4 33.1Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M146.4 33.1C145.1 33.7 143.5 33.7 141.8 32.8L115.6 19.4C111.7 17.4 108.6 12 108.6 7.2C108.6 4.6 109.5 2.7 111.1 1.9C112.3 1.3 113.9 1.3 115.6 2.2L141.8 15.6C145.7 17.5 148.9 23 148.9 27.8C148.9 30.4 147.9 32.3 146.4 33.1Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M121.2 19C121 18.9 120.8 18.6 120.8 18.3V17.3C120.8 16.5 120.2 15.6 119.6 15.3L117.2 14.1C116.5 13.7 116 14.1 116 14.9V15.9C116 16.1 115.8 16.3 115.6 16.2C115.4 16 115.2 15.7 115.2 15.5V14.5C115.2 13.2 116.1 12.5 117.2 13.1L119.6 14.3C120.7 14.9 121.6 16.4 121.6 17.8V18.7C121.6 19 121.4 19.1 121.2 19Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        d="M121.2 14.1C121 14 120.8 13.8 120.8 13.5C120.7 13.2 120.9 13 121.1 13.1C121.5 13.2 121.8 12.9 121.9 12.5C122.1 11.8 121.7 10.8 121.1 10.3C120.9 10.1 120.7 9.8 120.8 9.5C120.8 9.3 121.1 9.2 121.3 9.4C121.8 9.8 122.2 10.5 122.5 11.2C122.8 11.9 122.8 12.5 122.7 13.1C122.5 13.9 122 14.3 121.3 14.1C121.2 14.1 121.2 14.1 121.2 14.1V14.1Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        d="M123.6 20.2C123.3 20.1 123.2 19.8 123.2 19.5V18.6C123.2 17.9 122.8 17.1 122.3 16.7C122.1 16.5 121.9 16.2 122 16C122 15.7 122.3 15.7 122.5 15.9C123.3 16.6 124 17.9 124 19V19.9C124 20.2 123.8 20.3 123.6 20.2L123.6 20.2Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        d="M118.4 12.7C117.3 12.2 116.4 10.6 116.4 9.3C116.4 7.9 117.3 7.3 118.4 7.9C119.5 8.4 120.4 10 120.4 11.3C120.4 12.6 119.5 13.3 118.4 12.7ZM118.4 8.8C117.7 8.5 117.2 8.9 117.2 9.7C117.2 10.5 117.7 11.4 118.4 11.8C119 12.1 119.6 11.7 119.6 10.9C119.6 10.1 119 9.2 118.4 8.8Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        d="M135.5 25.1C135.3 24.9 135.1 24.6 135.1 24.4V19.5C135.1 19.2 135.3 19.1 135.5 19.2C135.7 19.3 135.9 19.7 135.9 19.9V24.8C135.9 25 135.7 25.2 135.5 25.1Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        d="M137.9 26.3C137.7 26.2 137.5 25.8 137.5 25.6V17.8C137.5 17.5 137.7 17.4 137.9 17.5C138.1 17.6 138.3 18 138.3 18.2V26C138.3 26.3 138.1 26.4 137.9 26.3Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        d="M133.1 23.8C132.9 23.7 132.7 23.4 132.7 23.1V21.2C132.7 20.9 132.9 20.8 133.1 20.9C133.3 21 133.5 21.3 133.5 21.6V23.6C133.5 23.8 133.3 23.9 133.1 23.8Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M47.5 89.8C46.8 89.8 46.2 89.7 45.7 89.4L40.7 86.8C39.1 86 38.2 84.2 38.2 81.8V50.3C38.2 46.1 41 41.2 44.5 39.4L70.4 26.2C71.3 25.8 72.2 25.5 73 25.5C73.7 25.5 74.3 25.7 74.8 26L79.8 28.5C81.4 29.3 82.3 31.1 82.3 33.5V65.1C82.3 69.3 79.5 74.1 76 75.9L50.1 89.1C49.2 89.6 48.3 89.8 47.5 89.8Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
      />
      <path
        d="M73 26.1C73.6 26.1 74.1 26.2 74.5 26.5L79.6 29C80.9 29.7 81.7 31.3 81.7 33.5V65.1C81.7 69.1 79 73.7 75.7 75.4L49.8 88.6C49 89 48.2 89.2 47.5 89.2C46.9 89.2 46.4 89.1 45.9 88.9L40.9 86.3C39.6 85.6 38.8 84.1 38.8 81.8V50.3C38.8 46.2 41.5 41.6 44.8 39.9L70.7 26.7C71.5 26.3 72.3 26.1 73 26.1ZM73 25C72.1 25 71.2 25.2 70.2 25.7L44.3 38.9C40.5 40.8 37.6 45.8 37.6 50.3V81.8C37.6 84.4 38.7 86.4 40.4 87.3L45.4 89.9C46.1 90.2 46.7 90.4 47.5 90.4C48.4 90.4 49.3 90.1 50.3 89.6L76.2 76.4C79.9 74.5 82.8 69.5 82.8 65.1V33.5C82.8 30.9 81.8 28.9 80.1 28L75.1 25.5C74.4 25.1 73.7 25 73 25V25Z"
        fill="var(--illustration-stroke-tertiary)"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M79.6 29C78.5 28.5 77.2 28.5 75.7 29.3L49.8 42.5C46.5 44.2 43.8 48.8 43.8 52.8V84.4C43.8 86.6 44.6 88.2 45.9 88.9L40.9 86.3C39.6 85.6 38.8 84.1 38.8 81.8V50.3C38.8 46.2 41.5 41.6 44.8 39.9L70.7 26.7C72.2 26 73.5 25.9 74.5 26.5L79.6 29Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.tertiary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M79.6 29C80.9 29.7 81.7 31.3 81.7 33.5V65.1C81.7 69.1 79 73.7 75.7 75.4L49.8 88.6C48.3 89.4 47 89.4 45.9 88.9C44.6 88.2 43.8 86.6 43.8 84.4V52.8C43.8 48.8 46.5 44.2 49.8 42.5L75.7 29.3C77.2 28.5 78.5 28.5 79.6 29Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M65.7 99.1C65.1 99.1 64.5 99 63.9 98.7L58.9 96.2C57.3 95.4 56.4 93.5 56.4 91.2V59.6C56.4 55.4 59.2 50.5 62.7 48.8L88.7 35.5C89.5 35.1 90.4 34.9 91.2 34.9C91.9 34.9 92.5 35 93 35.3L98 37.9C99.6 38.6 100.5 40.5 100.5 42.8V74.4C100.5 78.6 97.7 83.5 94.2 85.2L68.3 98.5C67.4 98.9 66.5 99.1 65.7 99.1H65.7Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
      />
      <path
        d="M91.2 35.4C91.8 35.4 92.3 35.6 92.8 35.8L97.8 38.3C99.1 39 99.9 40.6 99.9 42.8V74.4C99.9 78.4 97.3 83.1 93.9 84.7L68 98C67.2 98.4 66.4 98.6 65.7 98.6C65.1 98.6 64.6 98.4 64.2 98.2L59.1 95.6C57.8 95 57 93.4 57 91.2V59.6C57 55.6 59.7 50.9 63 49.3L88.9 36C89.7 35.6 90.5 35.4 91.2 35.4M91.2 34.3C90.3 34.3 89.4 34.6 88.4 35L62.5 48.3C58.8 50.1 55.9 55.1 55.9 59.6V91.2C55.9 93.8 56.9 95.8 58.6 96.7L63.7 99.2C64.3 99.5 65 99.7 65.7 99.7C66.6 99.7 67.6 99.4 68.5 99L94.5 85.7C98.2 83.9 101.1 78.9 101.1 74.4V42.8C101.1 40.2 100.1 38.2 98.3 37.3L93.3 34.8C92.7 34.5 92 34.3 91.2 34.3H91.2Z"
        fill="var(--illustration-stroke-tertiary)"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M97.8 38.3C96.8 37.8 95.4 37.9 93.9 38.6L68 51.8C64.7 53.5 62 58.1 62 62.2V93.7C62 96 62.9 97.5 64.2 98.2L59.1 95.6C57.8 95 57 93.4 57 91.2V59.6C57 55.6 59.7 50.9 63 49.3L88.9 36C90.4 35.3 91.7 35.3 92.8 35.8L97.8 38.3Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.tertiary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M97.8 38.3C99.1 39 99.9 40.6 99.9 42.8V74.4C99.9 78.4 97.3 83.1 93.9 84.7L68 98C66.5 98.7 65.2 98.7 64.2 98.2C62.9 97.5 62 96 62 93.7V62.2C62 58.1 64.7 53.5 68 51.8L93.9 38.6C95.4 37.9 96.7 37.8 97.8 38.3Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M83.9 108.5C83.3 108.5 82.7 108.3 82.2 108.1C82.1 108.1 82.1 108.1 82.1 108.1L77 105.5C75.5 104.7 74.6 102.9 74.6 100.5V68.9C74.6 64.7 77.4 59.9 80.9 58.1L106.8 44.9C107.7 44.4 108.6 44.2 109.4 44.2C110 44.2 110.6 44.3 111.2 44.6C111.2 44.6 116.2 47.2 116.2 47.2C117.8 48 118.7 49.8 118.7 52.2V83.7C118.7 88 115.8 92.8 112.4 94.6L86.4 107.8C85.6 108.2 84.7 108.5 83.9 108.5V108.5ZM89.5 68.1C88.3 68.7 87.3 70.5 87.3 71.9V92.9L103.7 84.6C104.9 84 105.9 82.2 105.9 80.7V59.7L89.5 68.1Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
      />
      <path
        d="M109.4 44.8C109.9 44.8 110.5 44.9 110.9 45.1L115.9 47.7C115.9 47.7 115.9 47.7 115.9 47.7C117.3 48.3 118.1 49.9 118.1 52.2V83.7C118.1 87.8 115.4 92.4 112.1 94.1L86.2 107.3C85.4 107.7 84.6 107.9 83.9 107.9C83.3 107.9 82.7 107.8 82.2 107.5C82.3 107.5 82.3 107.5 82.3 107.5L77.3 105C76 104.3 75.2 102.7 75.2 100.5V68.9C75.2 64.9 77.8 60.3 81.1 58.6L107.1 45.4C107.9 45 108.7 44.8 109.4 44.8M114 47.4C114.1 47.3 114.2 47.3 114.3 47.3C114.2 47.3 114.1 47.3 114 47.4ZM114.8 47.4C114.7 47.3 114.6 47.3 114.5 47.3C114.6 47.3 114.7 47.3 114.8 47.4ZM113.8 47.4C113.7 47.4 113.6 47.4 113.5 47.4C113.6 47.4 113.7 47.4 113.8 47.4ZM115.3 47.5C115.2 47.4 115.1 47.4 115 47.4C115.1 47.4 115.2 47.4 115.3 47.5ZM112.9 47.6C113 47.6 113.1 47.5 113.3 47.5C113.1 47.5 113 47.6 112.9 47.6ZM110.8 57.5C110.7 57.5 110.7 57.5 110.7 57.5C110.7 57.5 110.7 57.5 110.8 57.5ZM111 57.7C111 57.7 110.9 57.6 110.9 57.6C110.9 57.6 110.9 57.7 111 57.7ZM111.1 57.9C111.1 57.8 111.1 57.8 111 57.8C111.1 57.8 111.1 57.8 111.1 57.9ZM111.2 58.1C111.2 58 111.2 58 111.2 58C111.2 58 111.2 58 111.2 58.1ZM111.3 58.3C111.3 58.3 111.3 58.2 111.3 58.2C111.3 58.2 111.3 58.3 111.3 58.3ZM86.8 93.8L104 85.1C105.4 84.4 106.5 82.4 106.5 80.7V58.8L89.3 67.6C87.9 68.3 86.8 70.2 86.8 71.9V93.8ZM111.5 59.3C111.5 59.2 111.5 59.1 111.5 59C111.5 59.1 111.5 59.2 111.5 59.3ZM88.9 97.9C89 97.8 89.1 97.8 89.3 97.7C89.1 97.8 89 97.8 88.9 97.9ZM88 97.9C87.9 97.9 87.8 97.8 87.7 97.8C87.8 97.8 87.9 97.9 88 97.9ZM88.8 97.9C88.7 97.9 88.6 97.9 88.4 97.9C88.6 97.9 88.7 97.9 88.8 97.9ZM88.3 97.9C88.3 97.9 88.4 97.9 88.4 97.9C88.4 97.9 88.3 97.9 88.3 97.9ZM80.3 104.1C80.2 104 80.2 103.9 80.2 103.8C80.2 103.9 80.2 104 80.3 104.1ZM80.4 104.8C80.4 104.7 80.3 104.6 80.3 104.5C80.3 104.6 80.4 104.7 80.4 104.8ZM80.5 105.3C80.6 105.4 80.6 105.4 80.6 105.4C80.6 105.4 80.6 105.4 80.5 105.3C80.5 105.3 80.5 105.2 80.5 105.2C80.5 105.2 80.5 105.3 80.5 105.3ZM81.1 106.5C81.1 106.4 81 106.4 81 106.3C81 106.4 81.1 106.4 81.1 106.5ZM81.5 106.9C81.5 106.9 81.4 106.8 81.3 106.8C81.4 106.8 81.5 106.9 81.5 106.9ZM81.9 107.3C81.8 107.2 81.8 107.2 81.7 107.2C81.8 107.2 81.8 107.2 81.9 107.3ZM109.4 43.6C108.5 43.6 107.5 43.9 106.6 44.4L80.6 57.6C76.9 59.5 74 64.5 74 68.9V100.5C74 103.1 75 105.1 76.8 106L81.8 108.6C81.9 108.6 81.9 108.6 82 108.6C82.6 108.9 83.2 109 83.9 109C84.8 109 85.7 108.8 86.7 108.3L112.6 95.1C116.3 93.2 119.2 88.2 119.2 83.7V52.2C119.2 49.6 118.2 47.6 116.5 46.7C116.5 46.7 116.5 46.7 116.5 46.7L111.4 44.1C110.8 43.8 110.1 43.6 109.4 43.6H109.4ZM87.9 92V71.9C87.9 70.7 88.8 69.1 89.8 68.6L105.4 60.7V80.7C105.4 82 104.5 83.6 103.5 84.1L87.9 92V92Z"
        fill="var(--illustration-stroke-tertiary)"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M87.7 97.8C88.2 98 88.7 98 89.4 97.7L109.1 87.6C110.4 86.9 111.6 85 111.6 83.3V59.3C111.6 58.4 111.2 57.7 110.7 57.4L105.6 54.9C106.2 55.2 106.5 55.8 106.5 56.8V80.7C106.5 82.4 105.4 84.4 104 85.1L84.3 95.1C83.7 95.4 83.1 95.5 82.7 95.2L87.7 97.8Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.tertiary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M116 47.7C115 47.2 113.6 47.2 112.2 47.9L86.2 61.2C82.9 62.8 80.2 67.5 80.2 71.5V103.1C80.2 105.3 81.1 106.9 82.4 107.5L77.4 105C76 104.3 75.2 102.7 75.2 100.5V68.9C75.2 64.9 77.9 60.3 81.2 58.6L107.1 45.4C108.6 44.6 109.9 44.6 111 45.1L116 47.7Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.tertiary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M112.2 47.9L86.2 61.2C82.9 62.8 80.2 67.5 80.2 71.5V103.1C80.2 107.1 82.9 109 86.2 107.3L112.2 94.1C115.5 92.4 118.2 87.8 118.2 83.7V52.2C118.2 48.2 115.5 46.3 112.2 47.9ZM111.6 83.3C111.6 85 110.5 86.9 109.1 87.6L89.4 97.7C88 98.4 86.8 97.6 86.8 95.9V71.9C86.8 70.2 88 68.3 89.4 67.6L109.1 57.5C110.5 56.8 111.6 57.6 111.6 59.3V83.3Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
