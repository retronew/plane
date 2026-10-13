/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Smile } from "lucide-react";
import {
  ChatOutline,
  CodeOutline,
  H1Outline,
  H2Outline,
  H3Outline,
  H4Outline,
  H5Outline,
  H6Outline,
  ImageOutline,
  ListOutline,
  MinusSquareOutline,
  NumberedListOutline,
  QuoteOutline,
  TableEditorOutline,
  TextOutline,
  ToDoOutline,
} from "@makeplane/propel/icons";
// constants
import { COLORS_LIST } from "@/constants/common";
// helpers
import {
  insertTableCommand,
  toggleBlockquote,
  toggleBulletList,
  toggleOrderedList,
  toggleTaskList,
  toggleHeading,
  toggleTextColor,
  toggleBackgroundColor,
  insertImage,
  insertCallout,
  setText,
  openEmojiPicker,
} from "@/helpers/editor-commands";
// plane editor extensions
import { coreEditorAdditionalSlashCommandOptions } from "@/extensions/additional-slash-command-options";
// types
import type { CommandProps, ISlashCommandItem, TSlashCommandSectionKeys } from "@/types";
// local types
import type { TExtensionProps, TSlashCommandAdditionalOption } from "./root";
import { translate } from "@plane/i18n";

export type TSlashCommandSection = {
  key: TSlashCommandSectionKeys;
  title?: string;
  items: ISlashCommandItem[];
};

export const getSlashCommandFilteredSections =
  (args: TExtensionProps) =>
  ({ query }: { query: string }): TSlashCommandSection[] => {
    const { additionalOptions: externalAdditionalOptions, disabledExtensions, flaggedExtensions } = args;
    const SLASH_COMMAND_SECTIONS: TSlashCommandSection[] = [
      {
        key: "general",
        items: [
          {
            commandKey: "text",
            key: "text",
            title: translate("web.text"),
            description: translate("web.just_start_typing_with_plain_text"),
            searchTerms: ["p", "paragraph"],
            icon: <TextOutline className="size-3.5" />,
            command: ({ editor, range }) => setText(editor, range),
          },
          {
            commandKey: "h1",
            key: "h1",
            title: translate("web.heading_1"),
            description: translate("web.big_section_heading"),
            searchTerms: ["title", "big", "large"],
            icon: <H1Outline className="size-3.5" />,
            command: ({ editor, range }) => toggleHeading(editor, 1, range),
          },
          {
            commandKey: "h2",
            key: "h2",
            title: translate("web.heading_2"),
            description: translate("web.medium_section_heading"),
            searchTerms: ["subtitle", "medium"],
            icon: <H2Outline className="size-3.5" />,
            command: ({ editor, range }) => toggleHeading(editor, 2, range),
          },
          {
            commandKey: "h3",
            key: "h3",
            title: translate("web.heading_3"),
            description: translate("web.small_section_heading"),
            searchTerms: ["subtitle", "small"],
            icon: <H3Outline className="size-3.5" />,
            command: ({ editor, range }) => toggleHeading(editor, 3, range),
          },
          {
            commandKey: "h4",
            key: "h4",
            title: translate("web.heading_4"),
            description: translate("web.small_section_heading"),
            searchTerms: ["subtitle", "small"],
            icon: <H4Outline className="size-3.5" />,
            command: ({ editor, range }) => toggleHeading(editor, 4, range),
          },
          {
            commandKey: "h5",
            key: "h5",
            title: translate("web.heading_5"),
            description: translate("web.small_section_heading"),
            searchTerms: ["subtitle", "small"],
            icon: <H5Outline className="size-3.5" />,
            command: ({ editor, range }) => toggleHeading(editor, 5, range),
          },
          {
            commandKey: "h6",
            key: "h6",
            title: translate("web.heading_6"),
            description: translate("web.small_section_heading"),
            searchTerms: ["subtitle", "small"],
            icon: <H6Outline className="size-3.5" />,
            command: ({ editor, range }) => toggleHeading(editor, 6, range),
          },

          {
            commandKey: "numbered-list",
            key: "numbered-list",
            title: translate("web.numbered_list"),
            description: translate("web.create_a_numbered_list"),
            searchTerms: ["ordered"],
            icon: <NumberedListOutline className="size-3.5" />,
            command: ({ editor, range }) => toggleOrderedList(editor, range),
          },
          {
            commandKey: "bulleted-list",
            key: "bulleted-list",
            title: translate("web.bulleted_list"),
            description: translate("web.create_a_bulleted_list"),
            searchTerms: ["unordered", "point"],
            icon: <ListOutline className="size-3.5" />,
            command: ({ editor, range }) => toggleBulletList(editor, range),
          },
          {
            commandKey: "to-do-list",
            key: "to-do-list",
            title: translate("web.to_do_list"),
            description: translate("web.create_a_to_do_list"),
            searchTerms: ["todo", "task", "list", "check", "checkbox"],
            icon: <ToDoOutline className="size-3.5" />,
            command: ({ editor, range }) => toggleTaskList(editor, range),
          },
          {
            commandKey: "table",
            key: "table",
            title: translate("web.table"),
            description: translate("web.create_a_table"),
            searchTerms: ["table", "cell", "db", "data", "tabular"],
            icon: <TableEditorOutline className="size-3.5" />,
            command: ({ editor, range }) => insertTableCommand(editor, range),
          },
          {
            commandKey: "quote",
            key: "quote",
            title: translate("web.quote"),
            description: translate("web.capture_a_quote"),
            searchTerms: ["blockquote"],
            icon: <QuoteOutline className="size-3.5" />,
            command: ({ editor, range }) => toggleBlockquote(editor, range),
          },
          {
            commandKey: "code",
            key: "code",
            title: translate("web.code"),
            description: translate("web.capture_a_code_snippet"),
            searchTerms: ["codeblock"],
            icon: <CodeOutline className="size-3.5" />,
            command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
          },
          {
            commandKey: "callout",
            key: "callout",
            title: translate("web.callout"),
            icon: <ChatOutline className="size-3.5" />,
            description: translate("web.insert_callout"),
            searchTerms: ["callout", "comment", "message", "info", "alert"],
            command: ({ editor, range }: CommandProps) => insertCallout(editor, range),
          },
          {
            commandKey: "divider",
            key: "divider",
            title: translate("web.divider"),
            description: translate("web.visually_divide_blocks"),
            searchTerms: ["line", "divider", "horizontal", "rule", "separate"],
            icon: <MinusSquareOutline className="size-3.5" />,
            command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
          },
          {
            commandKey: "emoji",
            key: "emoji",
            title: translate("web.emoji"),
            description: translate("web.insert_an_emoji"),
            searchTerms: ["emoji", "icons", "reaction", "emoticon", "emotags"],
            icon: <Smile className="size-3.5" />,
            command: ({ editor, range }) => {
              openEmojiPicker(editor, range);
            },
          },
        ],
      },
      {
        key: "text-colors",
        title: translate("web.colors"),
        items: [
          {
            commandKey: "text-color",
            key: "text-color-default",
            title: translate("web.default"),
            description: translate("web.change_text_color"),
            searchTerms: ["color", "text", "default"],
            icon: <TextOutline className="size-3.5 text-primary" />,
            command: ({ editor, range }) => toggleTextColor(undefined, editor, range),
          },
          ...COLORS_LIST.map(
            (color) =>
              ({
                commandKey: "text-color",
                key: `text-color-${color.key}`,
                title: color.label,
                description: translate("web.change_text_color"),
                searchTerms: ["color", "text", color.label],

                icon: (
                  <TextOutline
                    className="size-3.5"
                    style={{
                      color: color.textColor,
                    }}
                  />
                ),

                command: ({ editor, range }) => toggleTextColor(color.key, editor, range),
              }) as ISlashCommandItem
          ),
        ],
      },
      {
        key: "background-colors",
        title: translate("web.background_colors"),
        items: [
          {
            commandKey: "background-color",
            key: "background-color-default",
            title: translate("web.default_background"),
            description: translate("web.change_background_color"),
            searchTerms: ["color", "bg", "background", "default"],
            icon: <TextOutline className="size-3.5" />,
            iconContainerStyle: {
              borderRadius: "4px",
              backgroundColor: "var(--background-color-surface-1)",
              border: "1px solid var(--border-color-strong)",
            },
            command: ({ editor, range }) => toggleTextColor(undefined, editor, range),
          },
          ...COLORS_LIST.map(
            (color) =>
              ({
                commandKey: "background-color",
                key: `background-color-${color.key}`,
                title: color.label,
                description: translate("web.change_background_color"),
                searchTerms: ["color", "bg", "background", color.label],
                icon: <TextOutline className="size-3.5" />,

                iconContainerStyle: {
                  borderRadius: "4px",
                  backgroundColor: color.backgroundColor,
                },

                command: ({ editor, range }) => toggleBackgroundColor(color.key, editor, range),
              }) as ISlashCommandItem
          ),
        ],
      },
    ];

    const internalAdditionalOptions: TSlashCommandAdditionalOption[] = [];
    if (!disabledExtensions?.includes("image")) {
      internalAdditionalOptions.push({
        commandKey: "image",
        key: "image",
        title: translate("web.image"),
        icon: <ImageOutline className="size-3.5" />,
        description: translate("web.insert_an_image"),
        searchTerms: ["img", "photo", "picture", "media", "upload"],
        command: ({ editor, range }: CommandProps) => insertImage({ editor, event: "insert", range }),
        section: "general",
        pushAfter: "code",
      });
    }

    [
      ...internalAdditionalOptions,
      ...(externalAdditionalOptions ?? []),
      ...coreEditorAdditionalSlashCommandOptions({
        disabledExtensions,
        flaggedExtensions,
      }),
    ]?.forEach((item) => {
      const sectionToPushTo = SLASH_COMMAND_SECTIONS.find((s) => s.key === item.section) ?? SLASH_COMMAND_SECTIONS[0];
      const itemIndexToPushAfter = sectionToPushTo.items.findIndex((i) => i.commandKey === item.pushAfter);
      if (itemIndexToPushAfter !== -1) {
        sectionToPushTo.items.splice(itemIndexToPushAfter + 1, 0, item);
      } else {
        sectionToPushTo.items.push(item);
      }
    });

    // oxlint-disable-next-line no-map-spread -- small static list built once per query
    const filteredSlashSections = SLASH_COMMAND_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (typeof query !== "string") return;

        const lowercaseQuery = query.toLowerCase();
        return (
          item.title.toLowerCase().includes(lowercaseQuery) ||
          item.description.toLowerCase().includes(lowercaseQuery) ||
          item.searchTerms.some((t) => t.includes(lowercaseQuery))
        );
      }),
    }));

    return filteredSlashSections.filter((s) => s.items.length !== 0);
  };
