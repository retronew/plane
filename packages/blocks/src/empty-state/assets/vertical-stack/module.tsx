/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ILLUSTRATION_COLOR_TOKEN_MAP } from "../helper";

export type ModuleVerticalStackIllustrationProps = {
  className?: string;
};

function BackgroundLayers() {
  return (
    <g opacity="0.2">
      <path
        d="M12.7 136C12.7 137.8 14.1 139.7 16.9 141.1L52.1 159C57.6 161.8 66.5 161.8 71.9 159L146 121.3C148.7 119.9 150.1 118.1 150.1 116.2V122.1C150.1 123.9 148.7 125.7 146 127.1L71.9 164.9C66.5 167.6 57.6 167.6 52.1 164.9L16.9 146.9C14.1 145.5 12.7 143.7 12.7 141.8V136Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.7 136C12.7 134.2 14.1 132.3 16.9 130.9L90.9 93.2C96.4 90.4 105.3 90.4 110.8 93.2L146 111.2C148.7 112.6 150.1 114.4 150.1 116.2C150.1 118.1 148.7 119.9 146 121.3L71.9 159C66.5 161.8 57.6 161.8 52.1 159L16.9 141.1C14.1 139.7 12.7 137.8 12.7 136Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.35"
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
        d="M12.7 117.5C12.7 119.4 14.1 121.2 16.9 122.6L52.1 140.5C57.6 143.3 66.5 143.3 71.9 140.5L146 102.8C148.7 101.4 150.1 99.6 150.1 97.8V103.6C150.1 105.4 148.7 107.3 146 108.7L71.9 146.4C66.5 149.2 57.6 149.2 52.1 146.4L16.9 128.4C14.1 127 12.7 125.2 12.7 123.4V117.5Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.7 117.5C12.7 115.7 14.1 113.9 16.9 112.5L90.9 74.7C96.4 71.9 105.3 71.9 110.8 74.7L146 92.7C148.7 94.1 150.1 95.9 150.1 97.8C150.1 99.6 148.7 101.4 146 102.8L71.9 140.5C66.5 143.3 57.6 143.3 52.1 140.5L16.9 122.6C14.1 121.2 12.7 119.4 12.7 117.5Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.35"
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
        d="M12.7 99C12.7 100.9 14.1 102.7 16.9 104.1L52.1 122.1C57.6 124.9 66.5 124.9 71.9 122.1L146 84.3C148.7 82.9 150.1 81.1 150.1 79.3V85.1C150.1 87 148.7 88.8 146 90.2L71.9 127.9C66.5 130.7 57.6 130.7 52.1 127.9L16.9 110C14.1 108.6 12.7 106.7 12.7 104.9V99Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.7 99C12.7 97.2 14.1 95.4 16.9 94L90.9 56.3C96.4 53.5 105.3 53.5 110.8 56.3L146 74.2C148.7 75.6 150.1 77.4 150.1 79.3C150.1 81.1 148.7 82.9 146 84.3L71.9 122.1C66.5 124.9 57.6 124.9 52.1 122.1L16.9 104.1C14.1 102.7 12.7 100.9 12.7 99Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M63.9 98.9C63.1 98.9 62.4 98.7 61.7 98.3L57.5 96.2C55.7 95.2 54.7 93.1 54.7 90.3V49.2C54.7 44.2 58 38.4 62.2 36.3L95.9 19.1C97 18.6 98 18.3 98.9 18.3C99.7 18.3 100.4 18.5 101 18.8L105.3 20.9C107.1 21.8 108.2 24 108.2 26.8V67.9C108.2 72.9 104.8 78.7 100.7 80.8L66.9 98.1C65.9 98.6 64.9 98.9 63.9 98.9Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
      />
      <path
        d="M98.9 18.8C99.6 18.8 100.2 18.9 100.8 19.2L105.1 21.4C106.7 22.2 107.7 24.1 107.7 26.8V67.9C107.7 72.8 104.5 78.4 100.5 80.4L66.7 97.6C65.7 98.1 64.8 98.4 63.9 98.4C63.2 98.4 62.5 98.2 62 97.9L57.7 95.7C56.1 94.9 55.1 93 55.1 90.3V49.2C55.1 44.3 58.4 38.8 62.4 36.7L96.2 19.5C97.1 19 98.1 18.8 98.9 18.8ZM98.9 17.8C97.9 17.8 96.8 18.1 95.7 18.6L61.9 35.9C57.6 38.1 54.2 43.9 54.2 49.2V90.3C54.2 93.3 55.3 95.6 57.3 96.6L61.5 98.8C62.2 99.1 63 99.3 63.9 99.3C64.9 99.3 66 99.1 67.1 98.5L100.9 81.3C105.3 79.1 108.7 73.2 108.7 67.9V26.8C108.7 23.8 107.5 21.5 105.5 20.5L101.2 18.3C100.5 18 99.8 17.8 98.9 17.8H98.9Z"
        fill="var(--illustration-stroke-tertiary)"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M102.1 27.5C102.1 27.5 102 27.5 102 27.5L102 27.5C102 27.5 102.1 27.5 102.1 27.5Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.tertiary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M105.1 21.4C105 21.3 104.9 21.3 104.8 21.3C104.8 21.3 104.7 21.2 104.6 21.2C104.4 21.1 104.1 21 103.8 21C103.7 21 103.6 21 103.6 21C102.6 20.9 101.6 21.1 100.5 21.7L66.7 38.9C62.7 41 59.5 46.5 59.5 51.4V92.5C59.5 92.7 59.5 92.9 59.5 93.1C59.5 93.2 59.5 93.4 59.5 93.5V93.5C59.5 93.6 59.5 93.8 59.6 93.9C59.6 94.2 59.7 94.5 59.7 94.8C59.8 94.9 59.8 95 59.8 95.2C59.9 95.3 59.9 95.4 60 95.5C60 95.6 60 95.7 60.1 95.7C60.1 95.9 60.2 96.1 60.3 96.2C60.3 96.3 60.4 96.3 60.4 96.4C60.4 96.4 60.4 96.4 60.4 96.4C60.5 96.5 60.5 96.6 60.6 96.6C60.6 96.7 60.7 96.8 60.8 96.9C60.9 97 60.9 97.1 61 97.1C61 97.2 61.1 97.3 61.2 97.3C61.2 97.4 61.3 97.4 61.4 97.5C61.5 97.6 61.8 97.8 62 97.9L57.7 95.7C56.1 94.9 55.1 93 55.1 90.3V49.2C55.1 44.3 58.4 38.8 62.4 36.7L96.2 19.5C97.9 18.6 99.5 18.6 100.8 19.2L105.1 21.4Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.tertiary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M102 27.5L102 27.5C102 27.5 102.1 27.5 102.1 27.5C102.1 27.5 102 27.5 102 27.5Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M105.1 21.4C105 21.3 104.9 21.3 104.8 21.3C104.8 21.3 104.7 21.2 104.6 21.2C104.4 21.1 104.1 21 103.8 21C103.7 21 103.6 21 103.6 21C102.6 20.9 101.6 21.1 100.5 21.7L66.7 38.9C62.7 41 59.5 46.5 59.5 51.4V92.5C59.5 92.7 59.5 92.9 59.5 93.1C59.5 93.2 59.5 93.4 59.5 93.5V93.5C59.5 93.6 59.5 93.8 59.6 93.9C59.6 94.2 59.7 94.5 59.7 94.8C59.8 94.9 59.8 95 59.8 95.2C59.9 95.3 59.9 95.4 60 95.5C60 95.6 60 95.7 60.1 95.7C60.1 95.9 60.2 96 60.3 96.2C60.3 96.3 60.4 96.3 60.4 96.4C60.4 96.4 60.4 96.4 60.4 96.4C60.5 96.5 60.5 96.6 60.6 96.6C60.6 96.7 60.7 96.8 60.8 96.9C60.9 97 60.9 97.1 61 97.1C61 97.2 61.1 97.3 61.2 97.3C61.2 97.4 61.3 97.4 61.4 97.5C61.5 97.6 61.8 97.8 62 97.9C63.2 98.6 64.9 98.5 66.7 97.6L100.5 80.4C104.5 78.4 107.7 72.8 107.7 67.9V26.8C107.7 24.1 106.7 22.2 105.1 21.4Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M93.3 73.5C93.2 73.5 93 73.5 92.9 73.4L88.6 71.2C88.3 71.1 88.1 70.7 88.1 70.3V63.2C88.1 62.5 88.5 61.8 89.1 61.5L94.9 58.6C95.1 58.5 95.2 58.4 95.4 58.4C95.5 58.4 95.7 58.5 95.8 58.5L100.1 60.7C100.4 60.9 100.6 61.2 100.6 61.7V68.8C100.6 69.5 100.2 70.2 99.7 70.4L93.8 73.4C93.6 73.5 93.5 73.5 93.3 73.5Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
      />
      <path
        d="M95.4 58.9C95.5 58.9 95.5 58.9 95.6 59L99.9 61.2C100 61.2 100.1 61.4 100.1 61.7V68.8C100.1 69.3 99.8 69.8 99.5 70L93.6 73C93.5 73 93.4 73.1 93.3 73.1C93.3 73.1 93.2 73 93.2 73L88.8 70.8C88.7 70.7 88.6 70.6 88.6 70.3V63.2C88.6 62.7 88.9 62.2 89.3 62L95.1 59C95.2 58.9 95.3 58.9 95.4 58.9ZM95.4 58C95.2 58 94.9 58 94.7 58.1L88.8 61.1C88.1 61.5 87.6 62.3 87.6 63.2V70.3C87.6 70.9 87.9 71.4 88.4 71.7L92.7 73.9C92.9 74 93.1 74 93.3 74C93.6 74 93.8 74 94 73.8L99.9 70.9C100.6 70.5 101.1 69.6 101.1 68.8V61.7C101.1 61.1 100.8 60.5 100.3 60.3L96 58.1C95.8 58 95.6 58 95.4 58H95.4Z"
        fill="var(--illustration-stroke-tertiary)"
      />
      <path
        d="M93.3 53C93.2 53 93 53 92.9 52.9L88.6 50.7C88.3 50.5 88.1 50.2 88.1 49.8V42.6C88.1 42 88.5 41.3 89.1 41L94.9 38C95.1 37.9 95.2 37.9 95.4 37.9C95.5 37.9 95.7 37.9 95.8 38L100.1 40.2C100.4 40.3 100.6 40.7 100.6 41.1V48.3C100.6 48.9 100.2 49.6 99.7 49.9L93.8 52.9C93.6 53 93.5 53 93.3 53Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
      />
      <path
        d="M95.4 38.4C95.5 38.4 95.5 38.4 95.6 38.4L99.9 40.6C100 40.7 100.1 40.9 100.1 41.1V48.3C100.1 48.7 99.8 49.3 99.5 49.4L93.6 52.4C93.5 52.5 93.4 52.5 93.3 52.5C93.3 52.5 93.2 52.5 93.2 52.5L88.8 50.3C88.7 50.2 88.6 50 88.6 49.8V42.6C88.6 42.1 88.9 41.6 89.3 41.4L95.1 38.4C95.2 38.4 95.3 38.4 95.4 38.4ZM95.4 37.4C95.2 37.4 94.9 37.5 94.7 37.6L88.8 40.6C88.1 40.9 87.6 41.8 87.6 42.6V49.8C87.6 50.4 87.9 50.9 88.4 51.1L92.7 53.3C92.9 53.4 93.1 53.5 93.3 53.5C93.6 53.5 93.8 53.4 94 53.3L99.9 50.3C100.6 49.9 101.1 49.1 101.1 48.3V41.1C101.1 40.5 100.8 40 100.3 39.7L96 37.5C95.8 37.5 95.6 37.4 95.4 37.4H95.4Z"
        fill="var(--illustration-stroke-tertiary)"
      />
      <path
        d="M76.4 82.1C76.3 82.1 76.2 82.1 76 82L71.7 79.8C71.4 79.7 71.2 79.3 71.2 78.9V71.8C71.2 71.1 71.6 70.4 72.2 70.2L78 67.2C78.2 67.1 78.4 67 78.5 67C78.7 67 78.8 67.1 78.9 67.1L83.2 69.3C83.6 69.5 83.7 69.8 83.7 70.3V77.4C83.7 78.1 83.3 78.8 82.8 79L76.9 82C76.8 82.1 76.6 82.1 76.4 82.1Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
      />
      <path
        d="M78.5 67.5C78.6 67.5 78.6 67.5 78.7 67.6L83 69.8C83.2 69.8 83.3 70 83.3 70.3V77.4C83.3 77.9 83 78.4 82.6 78.6L76.7 81.6C76.6 81.6 76.5 81.7 76.4 81.7C76.4 81.7 76.3 81.6 76.3 81.6L72 79.4C71.8 79.3 71.7 79.2 71.7 78.9V71.8C71.7 71.3 72 70.8 72.4 70.6L78.3 67.6C78.4 67.5 78.4 67.5 78.5 67.5ZM78.5 66.6C78.3 66.6 78 66.6 77.8 66.7L72 69.7C71.2 70.1 70.7 70.9 70.7 71.8V78.9C70.7 79.5 71 80 71.5 80.3L75.8 82.5C76 82.6 76.2 82.6 76.4 82.6C76.7 82.6 76.9 82.6 77.1 82.5L83 79.5C83.7 79.1 84.2 78.2 84.2 77.4V70.3C84.2 69.7 83.9 69.1 83.5 68.9L79.1 66.7C78.9 66.6 78.7 66.6 78.5 66.6Z"
        fill="var(--illustration-stroke-tertiary)"
      />
      <path
        d="M76.4 61.6C76.3 61.6 76.2 61.6 76 61.5L71.7 59.3C71.4 59.1 71.2 58.8 71.2 58.4V51.2C71.2 50.6 71.6 49.9 72.2 49.6L78 46.6C78.2 46.5 78.4 46.5 78.5 46.5C78.7 46.5 78.8 46.5 78.9 46.6L83.2 48.8C83.6 48.9 83.7 49.3 83.7 49.7V56.9C83.7 57.5 83.3 58.2 82.8 58.5L76.9 61.5C76.8 61.6 76.6 61.6 76.4 61.6Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
      />
      <path
        d="M78.5 47C78.6 47 78.6 47 78.7 47L83 49.2C83.2 49.3 83.3 49.5 83.3 49.7V56.9C83.3 57.3 83 57.9 82.6 58.1L76.7 61C76.6 61.1 76.5 61.1 76.4 61.1C76.4 61.1 76.3 61.1 76.3 61.1L72 58.9C71.8 58.8 71.7 58.6 71.7 58.4V51.2C71.7 50.8 72 50.2 72.4 50L78.3 47C78.4 47 78.4 47 78.5 47ZM78.5 46C78.3 46 78 46.1 77.8 46.2L72 49.2C71.2 49.5 70.7 50.4 70.7 51.2V58.4C70.7 59 71 59.5 71.5 59.7L75.8 61.9C76 62 76.2 62.1 76.4 62.1C76.7 62.1 76.9 62 77.1 61.9L83 58.9C83.7 58.6 84.2 57.7 84.2 56.9V49.7C84.2 49.1 83.9 48.6 83.5 48.4L79.1 46.2C78.9 46.1 78.7 46 78.5 46Z"
        fill="var(--illustration-stroke-tertiary)"
      />
      <path
        d="M99.9 61.2C99.8 61.1 99.6 61.1 99.5 61.2L93.6 64.2C93.2 64.4 92.9 64.9 92.9 65.4V72.5C92.9 72.8 93 72.9 93.2 73L88.8 70.8C88.7 70.7 88.6 70.6 88.6 70.3V63.2C88.6 62.7 88.9 62.2 89.3 62L95.1 59C95.3 58.9 95.5 58.9 95.6 59L99.9 61.2Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.tertiary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M99.9 61.2C100 61.2 100.1 61.4 100.1 61.7V68.8C100.1 69.3 99.8 69.8 99.5 70L93.6 73C93.4 73.1 93.3 73.1 93.2 73C93 72.9 92.9 72.8 92.9 72.5V65.4C92.9 64.9 93.2 64.4 93.6 64.2L99.5 61.2C99.6 61.1 99.8 61.1 99.9 61.2Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M99.9 40.6C99.8 40.6 99.6 40.6 99.5 40.6L93.6 43.6C93.2 43.8 92.9 44.4 92.9 44.8V52C92.9 52.2 93 52.4 93.2 52.5L88.8 50.3C88.7 50.2 88.6 50 88.6 49.8V42.6C88.6 42.2 88.9 41.6 89.3 41.4L95.1 38.4C95.3 38.4 95.5 38.4 95.6 38.4L99.9 40.6Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.tertiary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M99.9 40.6C100 40.7 100.1 40.9 100.1 41.1V48.3C100.1 48.7 99.8 49.3 99.5 49.5L93.6 52.4C93.4 52.5 93.3 52.5 93.2 52.5C93 52.4 92.9 52.2 92.9 52V44.8C92.9 44.4 93.2 43.8 93.6 43.6L99.5 40.6C99.6 40.6 99.8 40.6 99.9 40.6Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M83 69.8C82.9 69.7 82.7 69.7 82.6 69.8L76.7 72.8C76.3 73 76 73.5 76 74V81.1C76 81.4 76.1 81.5 76.3 81.6L71.9 79.4C71.8 79.3 71.7 79.2 71.7 78.9V71.8C71.7 71.3 72 70.8 72.4 70.6L78.3 67.6C78.4 67.5 78.6 67.5 78.7 67.6L83 69.8Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.tertiary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M83 69.8C83.2 69.8 83.3 70 83.3 70.3V77.4C83.3 77.9 82.9 78.4 82.6 78.6L76.7 81.6C76.5 81.7 76.4 81.7 76.3 81.6C76.1 81.5 76 81.4 76 81.1V74C76 73.5 76.3 73 76.7 72.8L82.6 69.8C82.7 69.7 82.9 69.7 83 69.8Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M83 49.2C82.9 49.2 82.7 49.2 82.6 49.2L76.7 52.2C76.3 52.4 76 53 76 53.4V60.6C76 60.8 76.1 61 76.3 61.1L71.9 58.9C71.8 58.8 71.7 58.6 71.7 58.4V51.2C71.7 50.8 72 50.2 72.4 50L78.3 47C78.4 47 78.6 47 78.7 47L83 49.2Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.tertiary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M83 49.2C83.2 49.3 83.3 49.5 83.3 49.7V56.9C83.3 57.3 82.9 57.9 82.6 58.1L76.7 61C76.5 61.1 76.4 61.1 76.3 61.1C76.1 61 76 60.8 76 60.6V53.4C76 53 76.3 52.4 76.7 52.2L82.6 49.2C82.7 49.2 82.9 49.2 83 49.2Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.secondary}
        strokeWidth="0.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  );
}

function DetailLayers() {
  return (
    <>
      <path
        d="M51.4 8.8C50.3 8.3 48.8 8.3 47.2 9.1L10.8 27.7C7.2 29.5 4.3 34.6 4.3 39C4.3 41.5 5.2 43.2 6.6 43.9L4.5 42.8C3 42.1 2.1 40.4 2.1 37.9C2.1 33.5 5.1 28.4 8.7 26.6L45.1 8C46.7 7.2 48.1 7.2 49.3 7.7L51.4 8.8Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M51.4 8.8C52.9 9.6 53.8 11.3 53.8 13.8C53.8 18.2 50.8 23.3 47.2 25.1L10.8 43.6C9.2 44.5 7.8 44.5 6.6 43.9C5.2 43.2 4.3 41.5 4.3 39C4.3 34.6 7.2 29.5 10.8 27.7L47.2 9.1C48.8 8.3 50.3 8.3 51.4 8.8Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.4 35.5C12.2 35.6 12 35.4 12 35.1C12 34.9 12.2 34.5 12.4 34.4C12.6 34.3 12.8 34.4 12.8 34.7C12.8 35 12.6 35.3 12.4 35.5H12.4Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        d="M12.4 38.6C12.2 38.8 12 38.6 12 38.3C12 38 12.2 37.7 12.4 37.6C12.6 37.5 12.8 37.6 12.8 37.9C12.8 38.2 12.6 38.5 12.4 38.6H12.4Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        d="M12.4 32.3C12.2 32.4 12 32.3 12 32C12 31.7 12.2 31.3 12.4 31.2C12.6 31.1 12.8 31.2 12.8 31.5C12.8 31.8 12.6 32.2 12.4 32.3H12.4Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        d="M20.2 31.5L14.6 34.3C14.3 34.5 14.1 34.3 14.1 34C14.1 33.7 14.3 33.4 14.6 33.3L20.2 30.4C20.5 30.3 20.7 30.4 20.7 30.7C20.7 31 20.5 31.3 20.2 31.5Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        d="M20.2 34.6L14.6 37.5C14.3 37.6 14.1 37.5 14.1 37.2C14.1 36.9 14.3 36.6 14.6 36.5L20.2 33.6C20.5 33.5 20.7 33.6 20.7 33.9C20.7 34.2 20.5 34.5 20.2 34.6Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        d="M20.2 28.3L14.6 31.2C14.3 31.3 14.1 31.2 14.1 30.9C14.1 30.6 14.3 30.2 14.6 30.1L20.2 27.2C20.5 27.1 20.7 27.2 20.7 27.5C20.7 27.8 20.5 28.2 20.2 28.3Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        d="M45.3 22.9L40.5 25.3C39.9 25.6 39.4 25.3 39.4 24.6V18.7C39.4 18 39.9 17.2 40.5 17L45.3 14.5C45.8 14.2 46.3 14.6 46.3 15.2V21.1C46.3 21.8 45.8 22.6 45.3 22.9ZM40.5 17.8C40.3 17.9 40.1 18.2 40.1 18.4V24.2C40.1 24.5 40.3 24.6 40.5 24.5L45.3 22C45.5 21.9 45.6 21.7 45.6 21.4V15.6C45.6 15.4 45.5 15.3 45.3 15.4L40.5 17.8Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        d="M44.2 18L41.8 19.2C41.6 19.3 41.5 19.2 41.5 18.9C41.5 18.7 41.6 18.4 41.8 18.3L44.2 17.1C44.4 17 44.6 17.1 44.6 17.4C44.6 17.6 44.4 17.9 44.2 18Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        d="M43.5 20L41.5 21C41.3 21.1 41.1 21 41.1 20.8C41.1 20.6 41.3 20.3 41.5 20.2L43.5 19.1C43.7 19.1 43.9 19.2 43.9 19.4C43.9 19.6 43.7 19.9 43.5 20Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        d="M44.2 21.3L42.5 22.2C42.3 22.3 42.2 22.2 42.2 21.9C42.2 21.7 42.3 21.4 42.5 21.3L44.2 20.5C44.4 20.4 44.6 20.5 44.6 20.7C44.6 20.9 44.4 21.2 44.2 21.3Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        d="M29 26.5L27.3 27.4C26.9 27.5 26.6 27.3 26.6 26.9V24.8C26.6 24.3 26.9 23.8 27.3 23.6L29 22.7C29.4 22.5 29.7 22.8 29.7 23.2V25.3C29.7 25.8 29.4 26.3 29 26.5ZM27.3 24.4V26.5L29 25.6V23.6L27.3 24.4Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        d="M32.8 24.6L31.1 25.4C30.7 25.6 30.4 25.4 30.4 24.9V22.9C30.4 22.4 30.7 21.9 31.1 21.7L32.8 20.8C33.2 20.6 33.5 20.8 33.5 21.3V23.4C33.5 23.8 33.2 24.4 32.8 24.6ZM31.1 22.5V24.6L32.8 23.7V21.6L31.1 22.5Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        d="M32.8 29.1L31.1 30C30.7 30.2 30.4 30 30.4 29.5V27.5C30.4 27 30.7 26.5 31.1 26.3L32.8 25.4C33.2 25.2 33.5 25.4 33.5 25.9V28C33.5 28.4 33.2 29 32.8 29.1ZM31.1 27.1V29.2L32.8 28.3V26.2L31.1 27.1Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        d="M29 31.1L27.3 31.9C26.9 32.1 26.6 31.9 26.6 31.5V29.4C26.6 28.9 26.9 28.4 27.3 28.2L29 27.3C29.4 27.1 29.7 27.3 29.7 27.8V29.9C29.7 30.3 29.4 30.9 29 31.1ZM27.3 29V31.1L29 30.2V28.1L27.3 29Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M4.5 77.4C3.2 76.7 2.3 75.1 2.3 72.8C2.3 68.8 5.1 64.1 8.4 62.4L30.9 50.9C32.4 50.1 33.7 50.1 34.8 50.6L32.6 49.5C31.6 49 30.2 49 28.7 49.8L6.3 61.3C2.9 63 0.2 67.7 0.2 71.7C0.2 74 1 75.6 2.4 76.3L4.5 77.4Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M4.5 77.4C5.6 77.9 6.9 77.9 8.4 77.1L30.9 65.7C34.2 64 37 59.3 37 55.2C37 52.9 36.1 51.3 34.8 50.6C33.7 50.1 32.4 50.1 30.9 50.9L8.4 62.4C5.1 64.1 2.3 68.8 2.3 72.8C2.3 75.1 3.2 76.7 4.5 77.4Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11.5 66.8C11.6 66.6 11.7 66.6 11.8 66.6C11.8 66.7 11.9 66.8 11.8 67L11.8 67L8.8 72.1C8.7 72.2 8.6 72.3 8.5 72.2C8.5 72.2 8.5 72 8.5 71.9L11.5 66.8L11.5 66.8Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        d="M9.3 68.4C9.3 68.2 9.2 68.1 9 68.2C8.8 68.3 8.7 68.6 8.7 68.8C8.7 69 8.8 69.1 9 69C9.2 68.9 9.3 68.7 9.3 68.4ZM9.7 68.2C9.7 68.7 9.4 69.3 9 69.5C8.6 69.7 8.3 69.5 8.3 69C8.3 68.5 8.6 67.9 9 67.7C9.4 67.5 9.7 67.7 9.7 68.2Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        d="M11.6 70.1C11.6 69.9 11.5 69.8 11.3 69.9C11.1 69.9 11 70.2 11 70.4C11 70.6 11.1 70.7 11.3 70.6C11.5 70.5 11.6 70.3 11.6 70.1ZM12 69.9C12 70.4 11.7 70.9 11.3 71.1C10.9 71.3 10.6 71.1 10.6 70.6C10.6 70.1 10.9 69.6 11.3 69.3C11.7 69.1 12 69.4 12 69.9Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        d="M10.1 64.9C10.1 64.8 10.2 64.6 10.3 64.6C10.9 64.3 11.6 64.2 12.1 64.3C12.8 64.4 13.3 64.8 13.6 65.4C14 66 14.2 66.8 14.1 67.7C14.1 68.5 13.9 69.5 13.5 70.5C13.1 71.4 12.6 72.3 11.9 73C11.3 73.7 10.6 74.3 9.9 74.6C9.1 74.9 8.4 75 7.8 74.8C7.3 74.6 6.8 74.3 6.5 73.7C6.5 73.6 6.5 73.5 6.6 73.4C6.7 73.2 6.9 73.2 6.9 73.3C7.2 73.8 7.6 74.1 8.1 74.3C8.6 74.4 9.2 74.4 9.9 74.1C10.5 73.8 11.2 73.3 11.8 72.7C12.3 72 12.8 71.2 13.2 70.4C13.5 69.5 13.7 68.6 13.7 67.8C13.7 67 13.6 66.3 13.3 65.8C13 65.3 12.5 64.9 11.9 64.8C11.4 64.7 10.9 64.8 10.3 65C10.2 65.1 10.1 65 10.1 64.9L10.1 64.9Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M28 62.3L19.8 66.5C19.1 66.8 18.6 66.4 18.6 65.6C18.6 64.8 19.1 63.8 19.8 63.5L28 59.3C28.7 59 29.3 59.4 29.3 60.2C29.3 61 28.7 61.9 28 62.3Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M157.1 35.2C157.7 34.9 158 34.3 158 33.4V21.5C158 19.8 156.9 17.9 155.5 17.2L124.8 1.5C124.2 1.2 123.6 1.2 123.2 1.4L125.4 0.3C125.8 0.1 126.4 0.1 127 0.4L157.7 16.1C159.1 16.8 160.2 18.7 160.2 20.4V32.3C160.2 33.2 159.8 33.8 159.3 34.1L157.1 35.2Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.secondary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M157.1 35.2C156.7 35.4 156.1 35.4 155.5 35.1L124.8 19.4C123.4 18.7 122.3 16.8 122.3 15.2V3.3C122.3 2.4 122.7 1.7 123.2 1.4C123.6 1.2 124.2 1.2 124.8 1.5L155.5 17.2C156.9 17.9 158 19.8 158 21.5V33.4C158 34.3 157.7 34.9 157.1 35.2Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.primary}
        stroke={ILLUSTRATION_COLOR_TOKEN_MAP.stroke.primary}
        strokeWidth="0.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M135.4 14.6L142.6 18.2C143.1 18.5 143.6 18.2 143.6 17.5C143.6 16.8 143.1 15.9 142.6 15.6L135.4 12C134.8 11.7 134.4 12 134.4 12.8C134.4 13.5 134.8 14.3 135.4 14.6Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M135.9 20.6L145.9 25.6C146.8 26.1 147.4 25.6 147.4 24.6C147.4 23.6 146.7 22.4 145.9 22L135.9 16.9C135.1 16.5 134.4 17 134.4 18C134.4 19 135.1 20.1 135.9 20.6Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M129.4 10.9C129.5 11.1 129.6 11.2 129.7 11.3C129.9 11.4 130 11.3 130 11V10.6C130 10.5 130 10.4 129.9 10.2C129.8 10.1 129.7 10.1 129.6 10.1L127.6 10C127.4 10 127.3 10.1 127.3 10.3V13C127.3 13.2 127.4 13.3 127.5 13.4C127.6 13.6 127.7 13.6 127.8 13.6L128.1 13.6C128.3 13.5 128.3 13.3 128.2 13.1C128.2 13 128.1 12.8 128 12.8V10.8L129.4 10.9L129.4 10.9Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M128.2 9.1C128.2 9.2 128.3 9.4 128.5 9.4C128.6 9.5 128.8 9.4 128.8 9.2V8.8C128.8 8.7 128.7 8.5 128.6 8.4C128.6 8.3 128.4 8.2 128.3 8.2L126.3 8.2C126.2 8.2 126.1 8.3 126.1 8.4V11.2C126.1 11.3 126.1 11.5 126.2 11.6C126.3 11.7 126.4 11.8 126.5 11.8L126.8 11.7C127 11.7 127 11.5 127 11.3C126.9 11.1 126.8 11 126.7 10.9V9L128.2 9.1L128.2 9.1Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M131.3 12.1C131.2 12 131.1 11.9 131 11.9L129 11.9C128.8 11.9 128.8 12 128.8 12.2V14.9C128.8 15.1 128.8 15.2 128.9 15.3C129 15.4 129.1 15.5 129.2 15.5L131.2 15.6C131.4 15.6 131.4 15.5 131.4 15.3V12.5C131.4 12.4 131.4 12.3 131.3 12.1ZM130.8 14.7L129.4 14.7V12.8L130.8 12.8V14.7Z"
        fill={ILLUSTRATION_COLOR_TOKEN_MAP.fill.quaternary}
      />
    </>
  );
}

export function ModuleVerticalStackIllustration({ className }: ModuleVerticalStackIllustrationProps) {
  return (
    <svg
      width="162"
      height="168"
      viewBox="0 0 162 168"
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
