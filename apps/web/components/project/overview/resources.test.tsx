import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SWRConfig } from "swr";
import { MemoryRouter } from "react-router";
import useSWRInfinite from "swr/infinite";
import type { IProject, TProjectOverviewAttachment, TProjectOverviewLink } from "@plane/types";
import { EFileAssetType } from "@plane/types";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { calculateTimeAgo, convertBytesToSize, renderFormattedDate, renderFormattedTime } from "@plane/utils";
import { projectOverviewKey } from "@/services/project/project-overview.service";
import { ProjectOverviewResources } from "./resources";

const mocks = vi.hoisted(() => ({
  getLinks: vi.fn(),
  getAttachments: vi.fn(),
  getReactions: vi.fn(),
  createLink: vi.fn(),
  updateLink: vi.fn(),
  deleteLink: vi.fn(),
  deleteAttachment: vi.fn(),
  addReaction: vi.fn(),
  deleteReaction: vi.fn(),
  upload: vi.fn(),
  toast: vi.fn(),
  allowPermissions: vi.fn(),
  user: { id: "me" } as { id: string } | undefined,
  maxFileSize: 1024 * 1024,
}));
vi.mock("@plane/i18n", () => ({
  getCurrentLanguage: () => "en",
  useTranslation: () => ({
    t: (key: string, options?: { time?: string }) =>
      key === "web.project_overview.link_added_at" ? `Added ${options?.time}` : key,
  }),
}));
vi.mock("@/hooks/store/user", () => ({
  useUser: () => ({ data: mocks.user }),
  useUserPermissions: () => ({ allowPermissions: mocks.allowPermissions }),
}));
vi.mock("@/hooks/use-file-size", () => ({ useFileSize: () => ({ maxFileSize: mocks.maxFileSize }) }));
vi.mock("@plane/blocks/toast", () => ({ setToast: mocks.toast }));
vi.mock("@/services/file.service", () => ({
  FileService: class {
    uploadProjectAsset = mocks.upload;
  },
}));
vi.mock("@/services/project/project-overview.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/project/project-overview.service")>();
  return { ...actual, projectOverviewService: mocks };
});
// The picker emits API decimal code points. Keep the real Group to test its Unicode click contract.
vi.mock("@plane/blocks/emoji-reaction", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@plane/blocks/emoji-reaction")>();
  return {
    ...actual,
    EmojiReactionPicker: ({ onChange, disabled }: { onChange: (emoji: string) => void; disabled: boolean }) => (
      <button disabled={disabled} onClick={() => onChange("128105-8205-128187")}>
        pick reaction
      </button>
    ),
  };
});

const project = {
  id: "project-1",
  name: "Project",
  archived_at: null,
  member_role: 15,
} as IProject;
const link: TProjectOverviewLink = {
  id: "link-1",
  title: "Design",
  url: "https://example.com/design",
  project: project.id,
  created_by: "me",
  created_at: "2026-10-17T00:00:00Z",
};
const attachment: TProjectOverviewAttachment = {
  id: "asset-1",
  attributes: { name: "spec.pdf", size: 512, type: "application/pdf" },
  asset_url: "https://example.com/assets/spec.pdf",
  created_by: "me",
  created_by_detail: {
    id: "me",
    first_name: "Ada",
    last_name: "Lovelace",
    display_name: "Ada",
    avatar_url: "/api/assets/v2/static/avatar-1/",
    is_bot: false,
  },
  created_at: link.created_at,
};
const reaction = (actor: string) => ({
  id: actor,
  actor,
  reaction: "128105-8205-128187",
  actor_detail: { id: actor, display_name: actor },
});

function setup(options: { project?: IProject; children?: React.ReactNode; progress?: React.ReactNode } = {}) {
  const cache = new Map();
  const view = render(
    <SWRConfig
      value={{ provider: () => cache, dedupingInterval: 0, shouldRetryOnError: false, revalidateOnFocus: false }}
    >
      <MemoryRouter>
        <ProjectOverviewResources project={options.project ?? project} workspaceSlug="acme">
          {options.progress}
        </ProjectOverviewResources>
      </MemoryRouter>
      {options.children}
    </SWRConfig>
  );
  return { ...view, cache };
}
const button = (name: string | RegExp) => screen.getByRole("button", { name });
const openCreate = async () => {
  fireEvent.click(button("web.project_overview.add_link"));
  return screen.findByRole("dialog");
};
function fillLink(title = "Draft", url = "https://example.com/new") {
  fireEvent.change(screen.getByRole("textbox", { name: "web.project_overview.link_title" }), {
    target: { value: title },
  });
  fireEvent.change(screen.getByRole("textbox", { name: "web.project_overview.link_url" }), { target: { value: url } });
}
function submitLink() {
  fireEvent.submit(screen.getByRole("textbox", { name: "web.project_overview.link_url" }).closest("form")!);
}
async function ready() {
  await waitFor(() => expect(screen.queryByRole("button", { name: "pick reaction" })).toBeTruthy());
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { id: "me" };
  mocks.maxFileSize = 1024 * 1024;
  mocks.allowPermissions.mockReturnValue(false);
  mocks.getLinks.mockResolvedValue([]);
  mocks.getAttachments.mockResolvedValue([]);
  mocks.getReactions.mockResolvedValue([]);
  for (const fn of [
    mocks.createLink,
    mocks.updateLink,
    mocks.deleteLink,
    mocks.deleteAttachment,
    mocks.addReaction,
    mocks.deleteReaction,
    mocks.upload,
  ])
    fn.mockResolvedValue(undefined);
});

describe("resource link dialog motion", () => {
  let finishAnimation: () => void;
  beforeEach(() => {
    const finished = new Promise<void>((resolve) => {
      finishAnimation = resolve;
    });
    // Hold Base UI's actual transition lifecycle open; JSDOM does not run CSS transitions.
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0));
    vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
    Object.defineProperty(HTMLElement.prototype, "getAnimations", {
      configurable: true,
      value: () => [{ finished }],
    });
  });
  afterEach(() => {
    delete (HTMLElement.prototype as Partial<HTMLElement>).getAnimations;
    vi.unstubAllGlobals();
  });

  it.each(["cancel", "escape", "save"])(
    "animates entry and keeps the draft mounted until %s finishes closing",
    async (action) => {
      setup();
      fireEvent.click(button("web.project_overview.add_link"));
      const dialog = screen.getByRole("dialog");
      expect(dialog.hasAttribute("data-starting-style")).toBe(true);
      await waitFor(() => expect(dialog.hasAttribute("data-starting-style")).toBe(false));
      fillLink();
      if (action === "cancel") fireEvent.click(button("cancel"));
      else if (action === "escape")
        fireEvent.keyDown(screen.getByRole("textbox", { name: "web.project_overview.link_url" }), { key: "Escape" });
      else submitLink();
      await waitFor(() => expect(dialog.hasAttribute("data-ending-style")).toBe(true));
      expect(dialog.isConnected).toBe(true);
      expect(within(dialog).getByRole("textbox", { name: "web.project_overview.link_title" })).toHaveProperty(
        "value",
        "Draft"
      );
      await act(async () => finishAnimation());
      await waitFor(() => expect(dialog.isConnected).toBe(false));
      await openCreate();
      for (const input of screen.getAllByRole("textbox")) expect(input).toHaveProperty("value", "");
    }
  );
});

describe("project overview resources", () => {
  it("loads project scoped resources and renders safe links, titles, URLs and non-image attachments below the toolbar", async () => {
    mocks.getLinks.mockResolvedValue([link]);
    mocks.getAttachments.mockResolvedValue([attachment]);
    const { container } = setup();
    const anchor = await screen.findByRole("link", { name: "Design" });
    expect(anchor.getAttribute("href")).toBe(link.url);
    expect(screen.queryByText(link.url)).toBeNull();
    const file = screen.getByRole("link", { name: "spec.pdf" });
    expect(file.getAttribute("href")).toBe(attachment.asset_url);
    for (const item of [anchor, file]) {
      expect(item.getAttribute("target")).toBe("_blank");
      expect(item.getAttribute("rel")).toBe("noopener noreferrer");
    }
    expect(
      container.querySelector("section > div")!.compareDocumentPosition(container.querySelector("ul")!) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    for (const fn of [mocks.getLinks, mocks.getAttachments, mocks.getReactions])
      expect(fn).toHaveBeenCalledWith("acme", "project-1");
  });

  it("uses compact link rows with a link icon and added time, without an uploader avatar", async () => {
    mocks.getLinks.mockResolvedValue([link]);
    setup();
    const anchor = await screen.findByRole("link", { name: "Design" });
    const row = anchor.closest("li")!;
    expect(row.classList.contains("-mx-2")).toBe(true);
    expect(row.classList.contains("rounded-md")).toBe(true);
    expect(row.querySelector("svg.lucide-link")?.classList.contains("size-4")).toBe(true);
    const time = row.querySelector("time")!;
    expect(time.dateTime).toBe(link.created_at);
    expect(time.textContent).toBe(`Added ${calculateTimeAgo(link.created_at)}`);
    fireEvent.focus(time);
    expect(await screen.findByRole("tooltip")).toHaveProperty(
      "textContent",
      `${renderFormattedDate(link.created_at)} ${renderFormattedTime(link.created_at)}`
    );
    expect(time.parentElement).toBe(anchor.parentElement);
    expect(within(row).queryByText(link.url)).toBeNull();
    expect(within(row).getAllByRole("link")).toEqual([anchor]);
    expect(within(row).queryByRole("img")).toBeNull();
    expect(within(row).getByRole("button", { name: "web.project_overview.edit_link" })).toBeTruthy();
    expect(within(row).getByRole("button", { name: "web.project_overview.delete_link" })).toBeTruthy();
  });

  it("shows the URL as the link label when no title is provided", async () => {
    mocks.getLinks.mockResolvedValue([{ ...link, title: "" }]);
    setup();
    const anchor = await screen.findByRole("link", { name: link.url });
    expect(anchor.getAttribute("href")).toBe(link.url);
    expect(within(anchor.closest("li")!).getByText(`Added ${calculateTimeAgo(link.created_at)}`)).toBeTruthy();
  });

  it("shows the uploader after file size and before delete, with a name tooltip", async () => {
    mocks.getAttachments.mockResolvedValue([attachment]);
    setup();
    const profileLink = await screen.findByRole("link", { name: "Ada" });
    expect(profileLink.getAttribute("href")).toBe("/acme/profile/me/");
    expect(within(profileLink).queryByRole("img")).toBeNull();
    const row = screen.getByRole("link", { name: "spec.pdf" }).closest("li")!;
    const size = within(row).getByText(convertBytesToSize(attachment.attributes.size));
    const deleteButton = within(row).getByRole("button", { name: "web.project_overview.delete_attachment" });
    expect(size.compareDocumentPosition(profileLink) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(profileLink.compareDocumentPosition(deleteButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.mouseEnter(profileLink);
    fireEvent.mouseMove(profileLink);
    expect(await screen.findByRole("tooltip")).toHaveProperty("textContent", "Ada");
  });

  it.each([
    {
      created_by: "me",
      created_by_detail: { ...attachment.created_by_detail!, display_name: "", avatar_url: "" },
      name: "Ada Lovelace",
    },
    { created_by: null, created_by_detail: null, name: "unknown_user" },
  ])(
    "falls back to $name when the uploader has no display name or was deleted",
    async ({ created_by, created_by_detail, name }) => {
      mocks.getAttachments.mockResolvedValue([{ ...attachment, created_by, created_by_detail }]);
      setup({ project: { ...project, archived_at: link.created_at } });
      const trigger = await screen.findByRole(created_by ? "link" : "img", { name });
      expect(trigger.textContent).toBeTruthy();
      if (!created_by) expect(screen.queryByRole("link", { name })).toBeNull();
      expect(screen.queryByRole("button", { name: "web.project_overview.delete_attachment" })).toBeNull();
      fireEvent.mouseEnter(trigger);
      fireEvent.mouseMove(trigger);
      expect(await screen.findByRole("tooltip")).toHaveProperty("textContent", name);
    }
  );

  it("places counted resource sections after progress and collapses them independently", async () => {
    mocks.getLinks.mockResolvedValue([link]);
    mocks.getAttachments.mockResolvedValue([attachment]);
    setup({ progress: <h2>Progress</h2> });
    const file = await screen.findByRole("link", { name: "spec.pdf" });
    const linksToggle = button("common.links 1");
    const attachmentsToggle = button("attachments 1");
    const progress = screen.getByRole("heading", { name: "Progress" });
    expect(progress.compareDocumentPosition(linksToggle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(progress.compareDocumentPosition(attachmentsToggle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(attachmentsToggle);
    expect(attachmentsToggle.getAttribute("aria-expanded")).toBe("false");
    await waitFor(() => expect(screen.queryByRole("link", { name: "spec.pdf" })).toBeNull());
    expect(screen.getByRole("link", { name: "Design" })).toBeTruthy();
    fireEvent.click(attachmentsToggle);
    expect((await screen.findByRole("link", { name: "spec.pdf" })).getAttribute("href")).toBe(
      file.getAttribute("href")
    );
    expect(linksToggle.getAttribute("aria-expanded")).toBe("true");
  });

  it("creates a link through its own dialog and refreshes links", async () => {
    mocks.createLink.mockImplementation(async () => {
      mocks.getLinks.mockResolvedValue([link]);
    });
    setup();
    const dialog = await openCreate();
    expect(within(dialog).getByText("web.project_overview.add_link")).toBeTruthy();
    fillLink(" Design ", " https://example.com/design ");
    expect(
      within(dialog)
        .getAllByRole("textbox")
        .map((input) => input.getAttribute("name"))
    ).toEqual(["url", "title"]);
    fireEvent.click(within(dialog).getByRole("button", { name: "save" }));
    await waitFor(() =>
      expect(mocks.createLink).toHaveBeenCalledWith("acme", project.id, { title: "Design", url: link.url })
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(await screen.findByRole("link", { name: "Design" })).toBeTruthy();
  });

  it.each(["javascript:alert(1)", "ftp://example.com", "https://", ""])(
    "rejects invalid URL %s without losing the draft",
    async (url) => {
      setup();
      await openCreate();
      fillLink("Draft", url);
      submitLink();
      expect(await screen.findByRole("alert")).toHaveProperty("textContent", "web.project_overview.invalid_url");
      expect(mocks.createLink).not.toHaveBeenCalled();
      expect(screen.getByRole("textbox", { name: "web.project_overview.link_title" })).toHaveProperty("value", "Draft");
    }
  );

  it("creates a URL-only link and adds the protocol for a bare domain", async () => {
    setup();
    const dialog = await openCreate();
    fillLink("", " example.com/docs ");
    fireEvent.click(within(dialog).getByRole("button", { name: "save" }));
    await waitFor(() =>
      expect(mocks.createLink).toHaveBeenCalledWith("acme", project.id, { title: "", url: "http://example.com/docs" })
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("resets cancelled and saved drafts when creating or editing again", async () => {
    mocks.getLinks.mockResolvedValue([link]);
    setup();
    await openCreate();
    fillLink("Discard this", "javascript:alert(1)");
    submitLink();
    expect(await screen.findByRole("alert")).toBeTruthy();
    fireEvent.click(button("cancel"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(button("web.project_overview.edit_link"));
    await screen.findByRole("dialog");
    expect(screen.getByRole("textbox", { name: "web.project_overview.link_title" })).toHaveProperty(
      "value",
      link.title
    );
    expect(screen.getByRole("textbox", { name: "web.project_overview.link_url" })).toHaveProperty("value", link.url);
    expect(screen.queryByRole("alert")).toBeNull();
    submitLink();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await openCreate();
    for (const input of screen.getAllByRole("textbox")) expect(input).toHaveProperty("value", "");
  });

  it("updates a link and allows an empty display title", async () => {
    mocks.getLinks.mockResolvedValue([link]);
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "web.project_overview.edit_link" }));
    await screen.findByRole("dialog");
    fillLink("", "http://example.com/updated");
    submitLink();
    await waitFor(() =>
      expect(mocks.updateLink).toHaveBeenCalledWith("acme", project.id, link.id, {
        title: "",
        url: "http://example.com/updated",
      })
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("retains failed link drafts, toasts, locks pending form and prevents duplicate submit", async () => {
    let reject!: (error: Error) => void;
    mocks.createLink.mockImplementationOnce(
      () =>
        new Promise((_, failure) => {
          reject = failure;
        })
    );
    setup();
    await openCreate();
    fillLink();
    submitLink();
    submitLink();
    await waitFor(() => expect(button("save").getAttribute("aria-disabled")).toBe("true"));
    expect(button("cancel")).toHaveProperty("disabled", true);
    expect(mocks.createLink).toHaveBeenCalledTimes(1);
    reject(new Error("failed"));
    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith({ type: "error", title: "web.project_overview.resources_error" })
    );
    expect(screen.getByRole("textbox", { name: "web.project_overview.link_title" })).toHaveProperty("value", "Draft");
    expect(screen.getByRole("textbox", { name: "web.project_overview.link_url" })).toHaveProperty(
      "value",
      "https://example.com/new"
    );
    submitLink();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(mocks.createLink).toHaveBeenCalledTimes(2);
  });

  it.each(["links", "attachments"] as const)(
    "confirms deletion of %s, retains confirmation on failure, and refreshes after retry",
    async (resource) => {
      mocks.getLinks.mockResolvedValue([link]);
      mocks.getAttachments.mockResolvedValue([attachment]);
      const fn = resource === "links" ? mocks.deleteLink : mocks.deleteAttachment;
      fn.mockRejectedValueOnce(new Error("failed"));
      fn.mockImplementationOnce(async () => {
        (resource === "links" ? mocks.getLinks : mocks.getAttachments).mockResolvedValue([]);
      });
      setup();
      const name = resource === "links" ? "Design" : "spec.pdf";
      const id = resource === "links" ? link.id : attachment.id;
      fireEvent.click(
        await screen.findByRole("button", {
          name: `web.project_overview.delete_${resource === "links" ? "link" : "attachment"}`,
        })
      );
      const dialog = await screen.findByRole("alertdialog");
      expect(fn).not.toHaveBeenCalled();
      fireEvent.click(within(dialog).getByRole("button", { name: "delete" }));
      await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
      expect(screen.getByRole("alertdialog")).toBeTruthy();
      fireEvent.click(within(dialog).getByRole("button", { name: "delete" }));
      await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
      await waitFor(() => expect(screen.queryByRole("link", { name })).toBeNull());
      expect(fn).toHaveBeenLastCalledWith("acme", project.id, id);
    }
  );

  it.each([15, 20])("allows project role %s to add, but only owner/admin to manage", async (role) => {
    mocks.getLinks.mockResolvedValue([{ ...link, created_by: "other" }]);
    mocks.getAttachments.mockResolvedValue([{ ...attachment, created_by: "other" }]);
    setup({ project: { ...project, member_role: role as 15 | 20 } });
    await screen.findByRole("link", { name: "Design" });
    expect(button("web.project_overview.add_link")).toBeTruthy();
    expect(button("web.project_overview.upload_attachment")).toBeTruthy();
    expect(Boolean(screen.queryByRole("button", { name: "web.project_overview.edit_link" }))).toBe(role === 20);
    expect(Boolean(screen.queryByRole("button", { name: "web.project_overview.delete_attachment" }))).toBe(role === 20);
  });

  it("uses workspace admin permission for the explicit workspace slug", async () => {
    mocks.allowPermissions.mockReturnValue(true);
    mocks.getLinks.mockResolvedValue([{ ...link, created_by: "other" }]);
    setup({ project: { ...project, member_role: null } });
    expect(await screen.findByRole("button", { name: "web.project_overview.edit_link" })).toBeTruthy();
    expect(button("web.project_overview.add_link")).toBeTruthy();
    expect(mocks.allowPermissions).toHaveBeenCalledWith(
      [EUserPermissions.ADMIN],
      EUserPermissionsLevel.WORKSPACE,
      "acme"
    );
  });

  it("lets guests toggle only their own reaction using decimal code points, including multi-code-point emoji", async () => {
    mocks.getReactions.mockResolvedValue([reaction("me"), reaction("other")]);
    mocks.deleteReaction.mockImplementationOnce(async () => {
      mocks.getReactions.mockResolvedValue([reaction("other")]);
    });
    setup({ project: { ...project, member_role: 5 } });
    await ready();
    expect(screen.queryByRole("button", { name: "web.project_overview.add_link" })).toBeNull();
    fireEvent.click(button(/👩‍💻/));
    await waitFor(() => expect(mocks.deleteReaction).toHaveBeenCalledWith("acme", project.id, "128105-8205-128187"));
    expect(mocks.addReaction).not.toHaveBeenCalled();
    // The revalidated list now contains another actor only, so picking the same emoji adds our reaction.
    await waitFor(() => expect(button("pick reaction")).toHaveProperty("disabled", false));
    fireEvent.click(button("pick reaction"));
    await waitFor(() => expect(mocks.addReaction).toHaveBeenCalledWith("acme", project.id, "128105-8205-128187"));
    expect(mocks.deleteReaction).toHaveBeenCalledTimes(1);
  });

  it("keeps guest owner management available while hiding other actors' resource actions", async () => {
    mocks.getLinks.mockResolvedValue([link]);
    mocks.getAttachments.mockResolvedValue([{ ...attachment, created_by: "other" }]);
    setup({ project: { ...project, member_role: 5 } });
    expect(await screen.findByRole("button", { name: "web.project_overview.edit_link" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "web.project_overview.delete_attachment" })).toBeNull();
  });

  it("disables all writes on archived projects, including owner/admin actions and reaction buttons", async () => {
    mocks.allowPermissions.mockReturnValue(true);
    mocks.getLinks.mockResolvedValue([link]);
    mocks.getAttachments.mockResolvedValue([attachment]);
    mocks.getReactions.mockResolvedValue([reaction("me")]);
    setup({ project: { ...project, archived_at: link.created_at } });
    expect(await screen.findByRole("link", { name: "Design" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "web.project_overview.add_link" })).toBeNull();
    expect(screen.queryByRole("button", { name: "web.project_overview.edit_link" })).toBeNull();
    expect(screen.queryByRole("button", { name: "web.project_overview.delete_attachment" })).toBeNull();
    expect(screen.queryByRole("button", { name: "pick reaction" })).toBeNull();
    fireEvent.click(button(/👩‍💻/));
    expect(mocks.deleteReaction).not.toHaveBeenCalled();
  });

  it("uploads PDF through the official project asset signature, refreshes the list and preserves failed files for retry", async () => {
    mocks.upload.mockRejectedValueOnce(new Error("upload failed"));
    mocks.upload.mockImplementationOnce(async () => {
      mocks.getAttachments.mockResolvedValue([attachment]);
    });
    setup();
    const file = new File(["%PDF"], "spec.pdf", { type: "application/pdf" });
    const input = screen.getByLabelText("web.project_overview.upload_attachment", { selector: "input" });
    expect(input.getAttribute("accept")).toBeNull();
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith({ type: "error", title: "web.project_overview.upload_failed" })
    );
    expect(screen.getByText("spec.pdf")).toBeTruthy();
    fireEvent.click(button("common.retry"));
    expect(await screen.findByRole("link", { name: "spec.pdf" })).toBeTruthy();
    expect(mocks.upload).toHaveBeenLastCalledWith(
      "acme",
      project.id,
      {
        entity_identifier: project.id,
        entity_type: EFileAssetType.PROJECT_ATTACHMENT,
      },
      file
    );
    expect(mocks.upload).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("button", { name: "common.retry" })).toBeNull();
  });

  it("honors the instance file size limit", async () => {
    mocks.maxFileSize = 2;
    setup();
    fireEvent.change(screen.getByLabelText("web.project_overview.upload_attachment", { selector: "input" }), {
      target: { files: [new File(["large"], "file.bin")] },
    });
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith({ type: "error", title: "attachment.file_size_limit" });
  });

  it("retries failed SWR reads without suppressing successful resources", async () => {
    mocks.getLinks.mockRejectedValueOnce(new Error("unavailable"));
    mocks.getLinks.mockResolvedValueOnce([link]);
    mocks.getAttachments.mockResolvedValue([attachment]);
    setup();
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "web.project_overview.resources_errorcommon.retry"
    );
    expect(screen.getByRole("link", { name: "spec.pdf" })).toBeTruthy();
    fireEvent.click(button("common.retry"));
    expect(await screen.findByRole("link", { name: "Design" })).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("refreshes current project's SWRInfinite activity prefix, leaving other project caches untouched", async () => {
    const activityFetch = vi.fn().mockResolvedValue({ results: [], next: false });
    const otherFetch = vi.fn().mockResolvedValue({ results: [], next: false });
    function Activities({ other = false }: { other?: boolean }) {
      useSWRInfinite(
        () => [...projectOverviewKey("acme", other ? "other" : project.id, "activities"), ""],
        other ? otherFetch : activityFetch
      );
      return null;
    }
    setup({
      children: (
        <>
          <Activities />
          <Activities other />
        </>
      ),
    });
    await ready();
    await waitFor(() => expect(activityFetch).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(otherFetch).toHaveBeenCalledTimes(1));
    fireEvent.click(button("pick reaction"));
    await waitFor(() => expect(activityFetch).toHaveBeenCalledTimes(2));
    expect(otherFetch).toHaveBeenCalledTimes(1);
  });

  it("retains displayed reactions on failure and lets the guest retry without duplicate requests", async () => {
    mocks.getReactions.mockResolvedValue([reaction("other")]);
    let reject!: (error: Error) => void;
    mocks.addReaction.mockImplementationOnce(
      () =>
        new Promise((_, failure) => {
          reject = failure;
        })
    );
    setup({ project: { ...project, member_role: 5 } });
    await ready();
    fireEvent.click(button("pick reaction"));
    fireEvent.click(button("pick reaction"));
    expect(mocks.addReaction).toHaveBeenCalledTimes(1);
    expect(button(/👩‍💻/).closest("fieldset")).toHaveProperty("disabled", true);
    reject(new Error("reaction failed"));
    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith({ type: "error", title: "web.project_overview.resources_error" })
    );
    expect(button(/👩‍💻/)).toBeTruthy();
    fireEvent.click(button("pick reaction"));
    await waitFor(() => expect(mocks.addReaction).toHaveBeenCalledTimes(2));
  });

  it("blocks a draft opened before the project was archived", async () => {
    const cache = new Map();
    const config = { provider: () => cache, dedupingInterval: 0 };
    const { rerender } = render(
      <SWRConfig value={config}>
        <ProjectOverviewResources project={project} workspaceSlug="acme" />
      </SWRConfig>
    );
    await openCreate();
    fillLink();
    rerender(
      <SWRConfig value={config}>
        <ProjectOverviewResources project={{ ...project, archived_at: link.created_at }} workspaceSlug="acme" />
      </SWRConfig>
    );
    submitLink();
    expect(mocks.createLink).not.toHaveBeenCalled();
    expect(button("save")).toHaveProperty("disabled", true);
    expect(screen.getByRole("textbox", { name: "web.project_overview.link_title" })).toHaveProperty("value", "Draft");
  });

  it("does not render unsafe existing link URLs as anchors", async () => {
    mocks.getLinks.mockResolvedValue([{ ...link, url: "javascript:alert(1)" }]);
    setup();
    expect(await screen.findByText("Design")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Design" })).toBeNull();
  });

  it("drops an open draft and loads the new scoped data when project changes", async () => {
    mocks.getLinks.mockImplementation(async (_slug, id) =>
      id === project.id ? [link] : [{ ...link, id: "new", title: "Other project" }]
    );
    const cache = new Map();
    const config = { provider: () => cache, dedupingInterval: 0 };
    const { rerender } = render(
      <SWRConfig value={config}>
        <ProjectOverviewResources project={project} workspaceSlug="acme" />
      </SWRConfig>
    );
    await openCreate();
    fillLink();
    rerender(
      <SWRConfig value={config}>
        <ProjectOverviewResources project={{ ...project, id: "project-2" }} workspaceSlug="acme" />
      </SWRConfig>
    );
    expect(await screen.findByRole("link", { name: "Other project" })).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.queryByRole("link", { name: "Design" })).toBeNull();
    expect(mocks.getLinks).toHaveBeenCalledWith("acme", "project-2");
  });
});
