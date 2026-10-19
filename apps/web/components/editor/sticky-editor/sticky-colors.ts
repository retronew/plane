import { translate } from "@plane/i18n";

export const STICKY_COLORS_LIST: {
  key: string;
  label: string;
  backgroundColor: string;
}[] = [
  {
    key: "gray",
    get label() {
      return translate("web.gray");
    },
    backgroundColor: "var(--editor-colors-gray-background)",
  },
  {
    key: "peach",
    get label() {
      return translate("web.peach");
    },
    backgroundColor: "var(--editor-colors-peach-background)",
  },
  {
    key: "pink",
    get label() {
      return translate("web.pink");
    },
    backgroundColor: "var(--editor-colors-pink-background)",
  },
  {
    key: "orange",
    get label() {
      return translate("web.orange");
    },
    backgroundColor: "var(--editor-colors-orange-background)",
  },
  {
    key: "green",
    get label() {
      return translate("web.green");
    },
    backgroundColor: "var(--editor-colors-green-background)",
  },
  {
    key: "light-blue",
    get label() {
      return translate("web.light_blue");
    },
    backgroundColor: "var(--editor-colors-light-blue-background)",
  },
  {
    key: "dark-blue",
    get label() {
      return translate("web.dark_blue");
    },
    backgroundColor: "var(--editor-colors-dark-blue-background)",
  },
  {
    key: "purple",
    get label() {
      return translate("web.purple");
    },
    backgroundColor: "var(--editor-colors-purple-background)",
  },
];
