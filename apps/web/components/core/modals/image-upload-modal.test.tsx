import { StrictMode, type ReactNode } from "react";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UserImageUploadModal } from "./user-image-upload-modal";
import { WorkspaceImageUploadModal } from "./workspace-image-upload-modal";

const mocks = vi.hoisted(() => ({ upload: vi.fn(), onDrop: undefined as undefined | ((files: File[]) => void) }));
vi.mock("@/services/file.service", () => ({
  FileService: class {
    uploadUserAsset = mocks.upload;
    uploadWorkspaceAsset = mocks.upload;
  },
}));
vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "workspace" }) }));
vi.mock("@/hooks/store/use-workspace", () => ({
  useWorkspace: () => ({ currentWorkspace: { id: "workspace-id" }, updateWorkspaceLogo: vi.fn() }),
}));
vi.mock("@plane/i18n", () => ({ translate: (key: string) => key }));
vi.mock("@plane/blocks/toast", () => ({ setToast: vi.fn() }));
vi.mock("react-dropzone", () => ({
  useDropzone: ({ onDrop }: { onDrop: (files: File[]) => void }) => {
    mocks.onDrop = onDrop;
    return { getRootProps: () => ({}), getInputProps: () => ({}), isDragActive: false, fileRejections: [] };
  },
}));
vi.mock("@makeplane/propel/components/button", () => ({
  Button: ({
    label,
    onClick,
    disabled,
  }: {
    label: string;
    onClick: () => void | Promise<void>;
    disabled?: boolean;
  }) => (
    <button
      type="button"
      onClick={() => {
        void Promise.resolve(onClick()).catch(() => undefined);
      }}
      disabled={disabled}
    >
      {label}
    </button>
  ),
}));
vi.mock("@makeplane/propel/components/dialog", () => {
  const Part = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return Object.fromEntries(
    [
      "Dialog",
      "DialogActions",
      "DialogBody",
      "DialogContent",
      "DialogHeader",
      "DialogHeading",
      "DialogInfo",
      "DialogMain",
      "DialogTitle",
    ].map((name) => [name, Part])
  );
});

beforeEach(() => {
  vi.clearAllMocks();
  let id = 0;
  vi.spyOn(URL, "createObjectURL").mockImplementation(() => `blob:preview-${++id}`);
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  mocks.upload.mockResolvedValue({ asset_url: "/saved" });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function pick(name: string) {
  act(() => mocks.onDrop?.([new File([name], name, { type: "image/png" })]));
}

for (const [name, Modal] of [
  ["user", UserImageUploadModal],
  ["workspace", WorkspaceImageUploadModal],
] as const) {
  describe(`${name} image preview`, () => {
    function setup() {
      const props = { isOpen: true, onClose: vi.fn(), onSuccess: vi.fn(), handleRemove: vi.fn(), value: null };
      const view = render(
        <StrictMode>
          <Modal {...props} />
        </StrictMode>
      );
      return { ...view, props };
    }

    it("keeps one URL across rerenders, revokes replaced files and cleans up on unmount in StrictMode", () => {
      const view = setup();
      pick("first.png");
      const first = view.getByRole("img").getAttribute("src");
      view.rerender(
        <StrictMode>
          <Modal {...view.props} />
        </StrictMode>
      );
      expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
      expect(view.getByRole("img").getAttribute("src")).toBe(first);
      pick("second.png");
      expect(URL.revokeObjectURL).toHaveBeenCalledWith(first);
      const second = view.getByRole("img").getAttribute("src");
      expect(second).not.toBe(first);
      view.unmount();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith(second);
      expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
    });

    it("releases the selected image when cancelled, preserving the workspace exit delay", () => {
      vi.useFakeTimers();
      const view = setup();
      pick("first.png");
      fireEvent.click(view.getByText("web.cancel"));
      expect(view.props.onClose).toHaveBeenCalledOnce();
      if (name === "workspace") {
        view.rerender(
          <StrictMode>
            <Modal {...view.props} isOpen={false} />
          </StrictMode>
        );
        expect(URL.revokeObjectURL).not.toHaveBeenCalled();
        act(() => vi.advanceTimersByTime(299));
        expect(URL.revokeObjectURL).not.toHaveBeenCalled();
        act(() => vi.advanceTimersByTime(1));
      }
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview-1");
      expect(view.queryByRole("img")).toBeNull();
    });

    if (name === "workspace") {
      it("keeps the preview when reopened before the exit delay finishes", () => {
        vi.useFakeTimers();
        const view = setup();
        pick("first.png");
        fireEvent.click(view.getByText("web.cancel"));
        view.rerender(
          <StrictMode>
            <Modal {...view.props} isOpen={false} />
          </StrictMode>
        );
        act(() => vi.advanceTimersByTime(100));
        view.rerender(
          <StrictMode>
            <Modal {...view.props} />
          </StrictMode>
        );
        act(() => vi.advanceTimersByTime(300));
        expect(view.getByRole("img").getAttribute("src")).toBe("blob:preview-1");
        expect(URL.revokeObjectURL).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(0);
      });

      it("keeps a newly selected image instead of clearing it with an old close timer", () => {
        vi.useFakeTimers();
        const view = setup();
        pick("first.png");
        fireEvent.click(view.getByText("web.cancel"));
        act(() => vi.advanceTimersByTime(100));
        pick("second.png");
        expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview-1");
        act(() => vi.advanceTimersByTime(300));
        expect(view.getByRole("img").getAttribute("src")).toBe("blob:preview-2");
        expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
        expect(vi.getTimerCount()).toBe(0);
      });

      it("cancels pending close cleanup on unmount and releases the preview", () => {
        vi.useFakeTimers();
        const view = setup();
        pick("first.png");
        fireEvent.click(view.getByText("web.cancel"));
        expect(vi.getTimerCount()).toBe(1);
        view.unmount();
        expect(vi.getTimerCount()).toBe(0);
        expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:preview-1");
      });
    }

    it("keeps the preview URL alive while upload is pending", async () => {
      let finish!: (result: { asset_url: string }) => void;
      mocks.upload.mockReturnValue(
        new Promise((resolve) => {
          finish = resolve;
        })
      );
      const view = setup();
      pick("first.png");
      fireEvent.click(view.getByText("web.upload_save"));
      expect(mocks.upload).toHaveBeenCalledOnce();
      expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
      expect(URL.revokeObjectURL).not.toHaveBeenCalled();
      expect(view.getByRole("img").getAttribute("src")).toBe("blob:preview-1");
      await act(async () => {
        finish({ asset_url: "/saved" });
      });
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview-1");
    });

    it("retains its preview after failure and reuses it for a successful retry", async () => {
      mocks.upload.mockRejectedValueOnce(new Error("Offline"));
      vi.spyOn(console, "log").mockImplementation(() => undefined);
      const view = setup();
      pick("first.png");
      fireEvent.click(view.getByText("web.upload_save"));
      await waitFor(() => expect(view.getByText("web.upload_save")).toBeDefined());
      expect(view.props.onSuccess).not.toHaveBeenCalled();
      expect(view.getByRole("img").getAttribute("src")).toBe("blob:preview-1");
      expect(URL.revokeObjectURL).not.toHaveBeenCalled();
      fireEvent.click(view.getByText("web.upload_save"));
      await waitFor(() => expect(view.props.onSuccess).toHaveBeenCalledWith("/saved"));
      expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview-1");
    });

    it("clears the preview after upload even when the parent closes without unmounting", async () => {
      const view = setup();
      view.props.onSuccess.mockImplementation(() => {
        view.rerender(
          <StrictMode>
            <Modal {...view.props} isOpen={false} />
          </StrictMode>
        );
      });
      pick("first.png");
      fireEvent.click(view.getByText("web.upload_save"));
      await waitFor(() => expect(view.props.onSuccess).toHaveBeenCalledWith("/saved"));
      await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview-1"));
      view.rerender(
        <StrictMode>
          <Modal {...view.props} />
        </StrictMode>
      );
      expect(view.queryByRole("img")).toBeNull();
      expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    });
  });
}
