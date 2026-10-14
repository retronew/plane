/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setLanguage, translate } from "@plane/i18n";
// Load the editor source at runtime so this test does not add it to the web TS project.
const editorValidationPath = resolve(import.meta.dirname, "../../../packages/editor/src/helpers/file.ts");
const { EFileError, isFileValid } = (await import(editorValidationPath)) as {
  EFileError: Record<"INVALID_FILE_TYPE" | "FILE_SIZE_TOO_LARGE" | "NO_FILE_SELECTED", string>;
  isFileValid: (args: {
    acceptedMimeTypes: string[];
    file: File;
    maxFileSize: number;
    onError: (error: string, message: string) => void;
  }) => boolean;
};

describe("editor upload validation localization", () => {
  afterEach(async () => {
    await setLanguage("en");
  });
  it("preserves validation codes and reports localized file type and size errors", async () => {
    await setLanguage("zh-CN");
    const onError = vi.fn();
    const args = { acceptedMimeTypes: ["image/png"], maxFileSize: 1024 * 1024, onError };
    expect(isFileValid({ ...args, file: new File(["text"], "file.txt", { type: "text/plain" }) })).toBe(false);
    expect(onError).toHaveBeenLastCalledWith(EFileError.INVALID_FILE_TYPE, "文件类型无效。");
    expect(
      isFileValid({ ...args, file: new File([new Uint8Array(1024 * 1024 + 1)], "image.png", { type: "image/png" }) })
    ).toBe(false);
    expect(onError).toHaveBeenLastCalledWith(EFileError.FILE_SIZE_TOO_LARGE, "文件过大，请选择小于 1MB 的文件。");
    onError.mockClear();
    expect(
      isFileValid({ ...args, file: new File([new Uint8Array(1024 * 1024)], "image.png", { type: "image/png" }) })
    ).toBe(true);
    expect(onError).not.toHaveBeenCalled();
    await setLanguage("en");
    expect(isFileValid({ ...args, file: new File(["text"], "file.txt", { type: "text/plain" }) })).toBe(false);
    expect(onError).toHaveBeenLastCalledWith(EFileError.INVALID_FILE_TYPE, "Invalid file type.");
  });

  it("formats page permissions and layout messages without exposing internal enum values", async () => {
    await setLanguage("zh-CN");
    expect(translate("web.ui.page_access_changed", { access: "private" })).toBe("页面已设为私有，并移至私有页面区域。");
    expect(translate("web.ui.page_access_changed", { access: "public" })).toBe("页面已设为公开，并移至公开页面区域。");
    expect(translate("web.ui.layout_link_copied", { type: "EPIC" })).toBe("史诗链接已复制到剪贴板。");
    expect(translate("web.ui.layout_link_copied", { type: "PROJECT" })).toBe("工作项链接已复制到剪贴板。");
  });
});
