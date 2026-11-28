/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ILLUSTRATION_COLOR_TOKEN_MAP } from "../helper";

export type ViewVerticalStackIllustrationProps = {
  className?: string;
};

function BackgroundLayers() {
  return (
    <g opacity="0.2">
      <path
        d="M12.5 128.7C12.5 130.6 13.9 132.5 16.8 134L53.9 152.9C59.7 155.9 69.1 155.9 74.9 152.9L152.9 113.2C155.8 111.7 157.2 109.8 157.2 107.8V114C157.2 115.9 155.8 117.9 152.9 119.3L74.9 159.1C69.1 162 59.7 162 53.9 159.1L16.8 140.2C13.9 138.7 12.5 136.8 12.5 134.8V128.7Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.5 128.7C12.5 126.7 13.9 124.8 16.8 123.3L94.9 83.6C100.6 80.6 110 80.6 115.8 83.6L152.9 102.5C155.8 104 157.2 105.9 157.2 107.8C157.2 109.8 155.8 111.7 152.9 113.2L74.9 152.9C69.1 155.9 59.7 155.9 53.9 152.9L16.8 134C13.9 132.5 12.5 130.6 12.5 128.7Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

function ShadowLayers() {
  return (
    <g opacity="0.6">
      <path
        d="M12.5 109.2C12.5 111.1 13.9 113.1 16.8 114.5L53.9 133.5C59.7 136.4 69.1 136.4 74.9 133.5L152.9 93.7C155.8 92.2 157.2 90.3 157.2 88.4V94.5C157.2 96.5 155.8 98.4 152.9 99.9L74.9 139.6C69.1 142.6 59.7 142.6 53.9 139.6L16.8 120.7C13.9 119.2 12.5 117.3 12.5 115.4V109.2Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.5 109.2C12.5 107.3 13.9 105.3 16.8 103.9L94.9 64.1C100.6 61.2 110 61.2 115.8 64.1L152.9 83C155.8 84.5 157.2 86.4 157.2 88.4C157.2 90.3 155.8 92.2 152.9 93.7L74.9 133.5C69.1 136.4 59.7 136.4 53.9 133.5L16.8 114.5C13.9 113.1 12.5 111.1 12.5 109.2Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

function ForegroundLayers() {
  return (
    <>
      <path
        d="M62.2 126L61.9 126.1C61.9 126.1 62 126.1 62.1 126C62.1 126 62.2 126 62.2 126Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        d="M70.2 130L70 130.1C70 130.1 70 130.1 69.9 130.1L70.2 130Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />

      <path
        d="M12.5 89.7C12.5 91.7 13.9 93.6 16.8 95.1L53.9 114C59.7 116.9 69.1 116.9 74.9 114L152.9 74.2C155.8 72.8 157.2 70.8 157.2 68.9V75.1C157.2 77 155.8 78.9 152.9 80.4L74.9 120.2C69.1 123.1 59.7 123.1 53.9 120.2L16.8 101.2C13.9 99.8 12.5 97.8 12.5 95.9V89.7Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.5 89.7C12.5 87.8 13.9 85.9 16.8 84.4L94.9 44.6C100.6 41.7 110 41.7 115.8 44.6L152.9 63.6C155.8 65 157.2 67 157.2 68.9C157.2 70.8 155.8 72.8 152.9 74.2L74.9 114C69.1 116.9 59.7 116.9 53.9 114L16.8 95.1C13.9 93.6 12.5 91.7 12.5 89.7Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M131 3C132.2 2.4 133.6 2.5 135.2 3.3C138.9 5.2 141.9 10.3 141.9 14.7C141.9 17.2 140.9 18.9 139.5 19.7L141.8 18.5C143.3 17.7 144.2 16 144.2 13.5C144.2 9.1 141.2 4 137.6 2.1C136 1.3 134.5 1.2 133.4 1.8L131 3Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M131 3C129.6 3.8 128.6 5.5 128.6 8C128.6 12.4 131.6 17.5 135.2 19.4C136.9 20.2 138.3 20.3 139.5 19.7C140.9 18.9 141.9 17.2 141.9 14.7C141.9 10.3 138.9 5.2 135.2 3.3C133.6 2.5 132.2 2.4 131 3Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M133.8 8.1C133.6 8 133.5 7.7 133.5 7.5V5.7C133.5 5.5 133.6 5.3 133.8 5.4C134 5.5 134.2 5.8 134.2 6.1V7.8C134.2 8.1 134 8.2 133.8 8.1Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        d="M136.7 9.6C136.5 9.5 136.4 9.2 136.4 8.9V7.2C136.4 6.9 136.5 6.8 136.7 6.9C136.9 7 137.1 7.3 137.1 7.5V9.3C137.1 9.5 136.9 9.7 136.7 9.6Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        d="M137.8 17.1L132.8 14.6C132.2 14.3 131.7 13.4 131.7 12.7V6.5C131.7 5.8 132.2 5.5 132.8 5.8L137.8 8.3C138.4 8.7 138.9 9.5 138.9 10.2V16.4C138.9 17.1 138.4 17.4 137.8 17.1ZM132.8 6.7C132.6 6.5 132.4 6.7 132.4 6.9V13.1C132.4 13.3 132.6 13.6 132.8 13.7L137.8 16.3C138 16.4 138.2 16.2 138.2 16V9.8C138.2 9.6 138 9.3 137.8 9.2L132.8 6.7Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        d="M138.5 12.2L132 8.9C131.8 8.8 131.7 8.5 131.7 8.3C131.7 8.1 131.8 7.9 132 8L138.5 11.4C138.7 11.5 138.9 11.7 138.9 12C138.9 12.2 138.7 12.3 138.5 12.2Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        d="M52.2 1.8C51 1.2 49.4 1.2 47.7 2.1L9.4 21.6C5.6 23.6 2.5 28.9 2.5 33.5C2.5 36.1 3.4 38 5 38.7L2.7 37.6C1.2 36.8 0.2 35 0.2 32.4C0.2 27.7 3.3 22.4 7.1 20.4L45.5 0.9C47.1 0 48.7 -0 49.9 0.6L52.2 1.8H52.2Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M52.2 1.8C53.7 2.5 54.6 4.4 54.6 7C54.6 11.6 51.6 17 47.7 18.9L9.4 38.4C7.7 39.3 6.2 39.4 5 38.7C3.4 38 2.5 36.1 2.5 33.5C2.5 28.9 5.6 23.6 9.4 21.6L47.7 2.1C49.4 1.2 51 1.2 52.2 1.8Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M27 24.6C26.8 24.8 26.6 24.6 26.6 24.3V18.1C26.6 17.8 26.8 17.4 27 17.3C27.3 17.2 27.5 17.3 27.5 17.6V23.8C27.5 24.1 27.3 24.5 27 24.6Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        d="M29.8 20.4C29.6 20.5 29.3 20.4 29.3 20.1V16.7C29.3 16.4 29.6 16 29.8 15.9C30.1 15.8 30.3 15.9 30.3 16.2V19.6C30.3 19.9 30.1 20.3 29.8 20.4Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        d="M32.6 23.5C32.3 23.6 32.1 23.5 32.1 23.2V15.3C32.1 15 32.3 14.6 32.6 14.5C32.8 14.4 33 14.5 33 14.8V22.7C33 23 32.8 23.4 32.6 23.5Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        d="M12.6 29.2C12.4 29.3 12.2 29.2 12.2 28.9C12.2 28.6 12.4 28.2 12.6 28.1C12.9 27.9 13.1 28.1 13.1 28.4C13.1 28.7 12.9 29.1 12.6 29.2H12.6Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        d="M12.6 32.5C12.4 32.7 12.2 32.5 12.2 32.2C12.2 31.9 12.4 31.5 12.6 31.4C12.9 31.3 13.1 31.4 13.1 31.7C13.1 32 12.9 32.4 12.6 32.5H12.6Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        d="M12.6 25.8C12.4 26 12.2 25.8 12.2 25.5C12.2 25.2 12.4 24.8 12.6 24.7C12.9 24.6 13.1 24.7 13.1 25C13.1 25.3 12.9 25.7 12.6 25.8H12.6Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        d="M20.9 25L14.9 28C14.7 28.1 14.5 28 14.5 27.7C14.5 27.4 14.7 27 14.9 26.9L20.9 23.9C21.1 23.7 21.4 23.9 21.4 24.2C21.4 24.5 21.1 24.8 20.9 25Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        d="M20.9 28.3L14.9 31.4C14.7 31.5 14.5 31.3 14.5 31C14.5 30.7 14.7 30.4 14.9 30.2L20.9 27.2C21.1 27.1 21.4 27.2 21.4 27.5C21.4 27.8 21.1 28.2 20.9 28.3Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        d="M20.9 21.6L14.9 24.7C14.7 24.8 14.5 24.6 14.5 24.3C14.5 24 14.7 23.7 14.9 23.5L20.9 20.5C21.1 20.4 21.4 20.5 21.4 20.8C21.4 21.1 21.1 21.5 20.9 21.6Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        d="M45.7 16.6L40.6 19.1C40 19.4 39.5 19.1 39.5 18.4V12.2C39.5 11.5 40 10.6 40.6 10.3L45.7 7.8C46.3 7.5 46.8 7.8 46.8 8.5V14.7C46.8 15.4 46.3 16.3 45.7 16.6ZM40.6 11.2C40.4 11.3 40.3 11.6 40.3 11.8V18C40.3 18.2 40.4 18.3 40.6 18.2L45.7 15.7C45.9 15.6 46 15.3 46 15.1V8.9C46 8.7 45.9 8.5 45.7 8.6L40.6 11.2Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        d="M44.6 11.4L42.1 12.7C41.9 12.8 41.7 12.7 41.7 12.4C41.7 12.2 41.9 11.9 42.1 11.8L44.6 10.5C44.8 10.4 45 10.5 45 10.8C45 11 44.8 11.3 44.6 11.4Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        d="M43.9 13.5L41.7 14.6C41.5 14.7 41.3 14.6 41.3 14.4C41.3 14.1 41.5 13.8 41.7 13.7L43.9 12.6C44.1 12.5 44.2 12.6 44.2 12.9C44.2 13.1 44.1 13.4 43.9 13.5Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        d="M44.6 14.9L42.8 15.8C42.6 15.9 42.4 15.8 42.4 15.6C42.4 15.3 42.6 15.1 42.8 14.9L44.6 14C44.8 13.9 45 14 45 14.3C45 14.5 44.8 14.8 44.6 14.9Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
    </>
  );
}

function DetailLayers() {
  return (
    <>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M147 25.5C148.2 24.9 149.6 24.9 151.2 25.7C154.9 27.6 157.9 32.7 157.9 37.2C157.9 39.6 156.9 41.4 155.5 42.1L157.8 40.9C159.3 40.2 160.2 38.4 160.2 36C160.2 31.5 157.2 26.4 153.6 24.6C152 23.7 150.5 23.7 149.4 24.3L147 25.5Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M147 25.5C145.6 26.2 144.6 27.9 144.6 30.4C144.6 34.9 147.6 40 151.2 41.8C152.9 42.7 154.3 42.7 155.5 42.1C156.9 41.4 157.9 39.6 157.9 37.2C157.9 32.7 154.9 27.6 151.2 25.7C149.6 24.9 148.2 24.9 147 25.5Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M153.9 39.7L148.8 37.1C148.2 36.8 147.7 36 147.7 35.2V29.1C147.7 28.4 148.2 28 148.8 28.3L153.9 30.9C154.5 31.2 154.9 32 154.9 32.8V38.9C154.9 39.6 154.5 40 153.9 39.7ZM148.8 29.2C148.6 29.1 148.4 29.2 148.4 29.5V35.6C148.4 35.9 148.6 36.1 148.8 36.2L153.9 38.8C154.1 38.9 154.2 38.8 154.2 38.6V32.4C154.2 32.2 154.1 31.9 153.9 31.8L148.8 29.2Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        d="M154.6 34.8L148.1 31.5C147.9 31.4 147.7 31.1 147.7 30.8C147.7 30.6 147.9 30.5 148.1 30.6L154.6 33.9C154.8 34 155 34.3 155 34.5C155 34.8 154.8 34.9 154.6 34.8Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        d="M154.6 37.4L148.1 34.1C147.9 34 147.7 33.7 147.7 33.5C147.7 33.2 147.9 33.1 148.1 33.2L154.6 36.5C154.8 36.6 155 36.9 155 37.2C155 37.4 154.8 37.5 154.6 37.4Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        d="M150.3 37.8C150.1 37.7 149.9 37.5 149.9 37.2V31.9C149.9 31.7 150.1 31.6 150.3 31.7C150.5 31.8 150.6 32.1 150.6 32.3V37.6C150.6 37.8 150.5 37.9 150.3 37.8Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        d="M152.4 39C152.2 38.9 152.1 38.6 152.1 38.3V33.1C152.1 32.8 152.2 32.7 152.4 32.8C152.6 32.9 152.8 33.2 152.8 33.4V38.7C152.8 38.9 152.6 39.1 152.4 39Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M81.5 57.6C79.5 57.6 77.7 57.2 76.3 56.5L50.2 43.2C48.7 42.4 47.9 41.4 47.9 40.2V35.1C47.9 34 48.7 32.9 50.2 32.2L76.3 18.9C77.7 18.2 79.5 17.8 81.5 17.8C83.4 17.8 85.2 18.2 86.6 18.9L112.7 32.2C114.2 32.9 115 34 115 35.1V40.2C115 41.4 114.2 42.4 112.7 43.2L86.6 56.5C85.2 57.2 83.4 57.6 81.5 57.6H81.5ZM78.8 44C79.5 44.4 80.4 44.6 81.5 44.6C82.5 44.6 83.4 44.4 84.1 44L96.6 37.7L84.1 31.4C83.4 31 82.5 30.8 81.5 30.8C80.4 30.8 79.5 31 78.8 31.4L66.4 37.7L78.8 44Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
      />
      <path
        d="M81.5 18.3C83.2 18.3 85 18.6 86.4 19.3L112.4 32.6C113.8 33.3 114.5 34.2 114.5 35.1V40.2C114.5 41.2 113.8 42.1 112.4 42.8L86.4 56C85 56.7 83.2 57.1 81.5 57.1C79.7 57.1 77.9 56.7 76.5 56L50.5 42.8C49.1 42.1 48.4 41.1 48.4 40.2V35.1C48.4 34.2 49.1 33.3 50.5 32.6L76.5 19.3C77.9 18.6 79.7 18.3 81.5 18.3ZM81.5 45.1C82.5 45.1 83.6 44.9 84.4 44.5L97.7 37.7L84.4 30.9C83.6 30.5 82.5 30.3 81.5 30.3C80.4 30.3 79.3 30.5 78.5 30.9L65.2 37.7L78.5 44.5C79.3 44.9 80.4 45.1 81.5 45.1ZM81.5 17.3C79.4 17.3 77.5 17.7 76.1 18.4L50 31.7C48.3 32.6 47.4 33.8 47.4 35.1V40.2C47.4 41 47.7 42.5 50 43.7L76.1 56.9C77.5 57.7 79.4 58.1 81.5 58.1C83.5 58.1 85.4 57.7 86.8 56.9L112.9 43.7C115.2 42.5 115.5 41 115.5 40.2V35.1C115.5 34.4 115.2 32.9 112.9 31.7L86.8 18.4C85.4 17.7 83.5 17.3 81.5 17.3H81.5ZM67.5 37.7L79 31.8C79.6 31.5 80.5 31.3 81.5 31.3C82.4 31.3 83.3 31.5 83.9 31.8L95.4 37.7L83.9 43.6C83.3 43.9 82.4 44.1 81.5 44.1C80.5 44.1 79.6 43.9 79 43.6L67.5 37.7Z"
        fill="var(--illustration-stroke-tertiary)"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M81.2 93.2C78.8 93.2 76.7 92.8 75.4 92.2L49.5 79C49.2 78.8 48.9 78.7 48.7 78.5C48.7 78.5 48.7 78.5 48.6 78.5C48.1 78 47.8 77.4 47.8 76.8V71.7C47.8 70.8 48.4 70 49.5 69.4C50.5 68.9 51.9 68.6 53.3 68.6C54.5 68.6 55.7 68.8 56.7 69.2C56.8 69.3 57 69.4 57.5 69.6L76.8 79.4C78 80.1 79.7 80.4 81.5 80.4C83.2 80.4 84.9 80.1 86.2 79.4L105.4 69.6C105.9 69.4 106.1 69.2 106.2 69.2C107.2 68.8 108.4 68.6 109.6 68.6C111 68.6 112.4 68.9 113.4 69.4C114.5 70 115.2 70.8 115.2 71.7V76.8C115.2 77.4 114.8 78 114.3 78.5C114 78.7 113.7 78.8 113.5 79L87.9 92C86.4 92.8 83.9 93.2 81.2 93.2H81.2Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
      />
      <path
        d="M109.6 69.1C110.9 69.1 112.2 69.3 113.2 69.8C114.2 70.3 114.6 71 114.6 71.7V76.8C114.6 77.2 114.4 77.7 113.9 78.1C113.7 78.3 113.5 78.4 113.2 78.5L112.6 78.8L87.6 91.5C86.2 92.3 83.7 92.7 81.2 92.7C79.1 92.7 76.9 92.4 75.6 91.7L50.3 78.8L49.7 78.5C49.4 78.4 49.2 78.2 49 78.1C48.5 77.7 48.3 77.2 48.3 76.8V71.7C48.3 71 48.8 70.3 49.7 69.8C50.7 69.3 52 69.1 53.3 69.1C54.4 69.1 55.6 69.3 56.5 69.7C56.5 69.7 57.3 70.1 57.3 70.1L76.5 79.9C77.9 80.6 79.7 80.9 81.5 80.9C83.2 80.9 85 80.6 86.4 79.9L105.7 70.1C105.7 70.1 106.4 69.7 106.4 69.7C107.4 69.3 108.5 69.1 109.6 69.1ZM109.6 68.1C108.3 68.1 107.1 68.3 106 68.7C105.9 68.8 105.6 68.9 105.2 69.2L85.9 79C84.8 79.6 83.1 79.9 81.5 79.9C79.8 79.9 78.1 79.6 77 79L57.7 69.1C57.3 68.9 57 68.8 56.9 68.7C55.8 68.3 54.6 68.1 53.3 68.1C51.8 68.1 50.4 68.4 49.3 68.9C47.5 69.8 47.2 71 47.2 71.6V76.7C47.2 77.3 47.4 78.1 48.3 78.8C48.3 78.9 48.4 78.9 48.4 78.9C48.7 79.1 48.9 79.3 49.2 79.4L49.9 79.7L75.2 92.6C77 93.6 79.8 93.7 81.2 93.7C84 93.7 86.5 93.2 88.1 92.4L113.1 79.7L113.7 79.4C114 79.3 114.2 79.1 114.5 78.9C114.5 78.9 114.6 78.9 114.6 78.9C115.5 78.1 115.7 77.3 115.7 76.7V71.6C115.7 71 115.4 69.8 113.6 68.9C112.5 68.4 111.1 68.1 109.6 68.1V68.1Z"
        fill="var(--illustration-stroke-tertiary)"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M81.2 75.4C78.8 75.4 76.7 75 75.4 74.4L49.5 61.2C49.2 61 48.9 60.9 48.7 60.7C48.7 60.7 48.7 60.7 48.6 60.6C48.1 60.1 47.8 59.6 47.8 58.9V53.8C47.8 53 48.4 52.1 49.5 51.6C50.5 51.1 51.9 50.8 53.3 50.8C54.5 50.8 55.7 51 56.7 51.4C56.8 51.4 57 51.6 57.5 51.8L76.8 61.6C78 62.2 79.7 62.6 81.5 62.6C83.2 62.6 84.9 62.2 86.2 61.6L105.4 51.8C105.9 51.6 106.1 51.4 106.2 51.4C107.2 51 108.4 50.8 109.6 50.8C111 50.8 112.4 51.1 113.4 51.6C114.5 52.1 115.2 53 115.2 53.8V58.9C115.2 59.6 114.8 60.2 114.2 60.7C114 60.9 113.7 61 113.5 61.2L87.9 74.2C86.4 74.9 83.9 75.4 81.2 75.4H81.2Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
      />
      <path
        d="M109.6 51.3C110.9 51.3 112.2 51.5 113.2 52C114.2 52.5 114.6 53.2 114.6 53.8V58.9C114.6 59.4 114.4 59.9 113.9 60.3C113.7 60.4 113.5 60.6 113.2 60.7L112.6 61L87.6 73.7C86.2 74.5 83.7 74.9 81.2 74.9C79.1 74.9 76.9 74.6 75.6 73.9L50.3 61L49.7 60.7C49.4 60.6 49.2 60.4 49 60.3C48.5 59.9 48.3 59.4 48.3 58.9V53.8C48.3 53.2 48.8 52.5 49.7 52C50.7 51.5 52 51.3 53.3 51.3C54.4 51.3 55.6 51.5 56.5 51.9C56.5 51.9 57.3 52.2 57.3 52.2L76.5 62.1C77.9 62.8 79.7 63.1 81.5 63.1C83.2 63.1 85 62.8 86.4 62.1L105.7 52.3C105.7 52.3 106.4 51.9 106.4 51.9C107.4 51.5 108.5 51.3 109.6 51.3ZM109.6 50.3C108.3 50.3 107.1 50.5 106 50.9C105.9 51 105.6 51.1 105.2 51.3L85.9 61.2C84.8 61.7 83.1 62.1 81.5 62.1C79.8 62.1 78.1 61.7 77 61.2L57.7 51.3C57.3 51.1 57 51 56.9 50.9C55.8 50.5 54.6 50.2 53.3 50.2C51.8 50.2 50.4 50.6 49.3 51.1C47.5 52 47.2 53.2 47.2 53.8V58.9C47.2 59.5 47.4 60.3 48.3 61C48.3 61 48.4 61.1 48.4 61.1C48.7 61.3 48.9 61.4 49.2 61.6L49.9 61.9L75.2 74.8C77 75.8 79.8 75.9 81.2 75.9C84 75.9 86.5 75.4 88.1 74.6L113.1 61.9L113.7 61.6C114 61.4 114.3 61.3 114.5 61.1C114.5 61.1 114.6 61.1 114.6 61C115.5 60.3 115.7 59.5 115.7 58.9V53.8C115.7 53.2 115.4 52 113.6 51.1C112.5 50.6 111.1 50.2 109.6 50.2V50.3Z"
        fill="var(--illustration-stroke-tertiary)"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M101 35.1C101 34.6 100.6 34.1 99.8 33.6L84.4 25.8C82.8 25 80.2 25 78.5 25.8L63.1 33.6C62.3 34.1 61.9 34.6 61.9 35.1V40.2C61.9 39.7 62.3 39.2 63.1 38.8L78.5 30.9C80.2 30.1 82.8 30.1 84.4 30.9L99.8 38.8C100.6 39.2 101 39.7 101 40.2V35.1Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.tertiary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M48.4 35.1C48.4 36 49.1 37 50.5 37.6L76.5 50.9C79.3 52.3 83.7 52.3 86.4 50.9L112.4 37.6C113.8 37 114.5 36 114.5 35.1V40.2C114.5 41.2 113.8 42.1 112.4 42.8L86.4 56C83.7 57.4 79.3 57.4 76.5 56L50.5 42.8C49.1 42.1 48.4 41.1 48.4 40.2V35.1Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.tertiary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M112.4 32.6L86.4 19.3C83.7 18 79.3 18 76.5 19.3L50.5 32.6C49.1 33.3 48.4 34.2 48.4 35.1C48.4 36 49.1 37 50.5 37.6L76.5 50.9C79.3 52.3 83.7 52.3 86.4 50.9L112.4 37.6C113.8 37 114.5 36 114.5 35.1C114.5 34.2 113.8 33.3 112.4 32.6ZM99.8 36.6L84.4 44.5C82.8 45.3 80.2 45.3 78.5 44.5L63.1 36.6C62.3 36.2 61.9 35.7 61.9 35.1C61.9 34.6 62.3 34.1 63.1 33.6L78.5 25.8C80.2 25 82.8 25 84.4 25.8L99.8 33.6C100.6 34.1 101 34.6 101 35.1C101 35.7 100.6 36.2 99.8 36.6Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M114.6 71.7V76.8C114.6 77.2 114.4 77.7 113.9 78.1C113.7 78.3 113.5 78.4 113.2 78.5L112.6 78.8L87.6 91.5C84.8 93 78.4 93.1 75.6 91.7L50.3 78.8L49.7 78.5C49.4 78.4 49.2 78.2 49 78.1C48.5 77.7 48.3 77.2 48.3 76.8V71.7C48.3 72.1 48.5 72.6 49 73C49.2 73.1 49.4 73.3 49.7 73.4L50.3 73.7L75.6 86.6C78.4 88 84.8 87.9 87.6 86.4L112.6 73.7L113.2 73.4C113.5 73.3 113.7 73.1 113.9 73C114.4 72.6 114.6 72.1 114.6 71.7Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.tertiary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M114.6 71.7C114.6 72.1 114.4 72.6 113.9 73C113.7 73.1 113.5 73.3 113.2 73.4L112.6 73.7L87.6 86.4C84.8 87.9 78.4 88 75.6 86.6L50.3 73.7L49.7 73.4C49.4 73.3 49.2 73.1 49 73C48.5 72.6 48.3 72.1 48.3 71.7C48.3 71 48.8 70.3 49.7 69.8C51.6 68.9 54.5 68.8 56.5 69.7C56.5 69.7 57.3 70.1 57.3 70.1L76.5 79.9C79.3 81.3 83.7 81.3 86.4 79.9L105.7 70.1C105.7 70.1 106.4 69.7 106.4 69.7C108.4 68.8 111.3 68.9 113.2 69.8C114.2 70.3 114.6 71 114.6 71.7Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M114.6 53.8V58.9C114.6 59.4 114.4 59.9 113.9 60.3C113.7 60.4 113.5 60.6 113.2 60.7L112.6 61L87.6 73.7C84.8 75.2 78.4 75.3 75.6 73.9L50.3 61L49.7 60.7C49.4 60.6 49.2 60.4 49 60.3C48.5 59.9 48.3 59.4 48.3 58.9V53.8C48.3 54.3 48.5 54.7 49 55.2C49.2 55.3 49.4 55.5 49.7 55.6L50.3 55.9L75.6 68.8C78.4 70.2 84.8 70.1 87.6 68.6L112.6 55.9L113.2 55.6C113.5 55.5 113.7 55.3 113.9 55.2C114.4 54.8 114.6 54.3 114.6 53.8Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.tertiary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M114.6 53.8C114.6 54.3 114.4 54.8 113.9 55.2C113.7 55.3 113.5 55.5 113.2 55.6L112.6 55.9L87.6 68.6C84.8 70.1 78.4 70.2 75.6 68.8L50.3 55.9L49.7 55.6C49.4 55.5 49.2 55.3 49 55.2C48.5 54.7 48.3 54.3 48.3 53.8C48.3 53.2 48.8 52.5 49.7 52C51.6 51.1 54.5 51 56.5 51.9C56.5 51.9 57.3 52.2 57.3 52.2L76.5 62.1C79.3 63.4 83.7 63.4 86.4 62.1L105.7 52.3C105.7 52.3 106.4 51.9 106.4 51.9C108.4 51 111.3 51.1 113.2 52C114.2 52.5 114.6 53.2 114.6 53.8Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  );
}

export function ViewVerticalStackIllustration({ className }: ViewVerticalStackIllustrationProps) {
  return (
    <svg
      width="162"
      height="163"
      viewBox="0 0 162 163"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <BackgroundLayers />
      <ShadowLayers />
      <ForegroundLayers />
      <DetailLayers />
    </svg>
  );
}
