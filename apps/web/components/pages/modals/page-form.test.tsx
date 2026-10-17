import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { TLogoProps } from "@plane/types";
import { Dialog, DialogContent } from "@makeplane/propel/components/dialog";
import { PageForm } from "./page-form";

const mocks = vi.hoisted(() => ({
  handleFormData: vi.fn(),
  logo: undefined as TLogoProps | undefined,
}));
vi.mock("react-router", () => ({ useParams: () => ({ workspaceSlug: "workspace", projectId: "route-project" }) }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/use-platform-os", () => ({ usePlatformOS: () => ({ isMobile: false }) }));
vi.mock("@plane/blocks/emoji-icon-picker", () => ({ EmojiPicker: () => null, Logo: () => null }));
vi.mock("@/components/common/access-field", () => ({ AccessField: () => null }));
vi.mock("@/components/settings/workspace/configuration/template-picker", () => ({
  TemplatePicker: ({
    projectId,
    workspaceSlug,
    kind,
    onApply,
  }: {
    projectId: string;
    workspaceSlug: string;
    kind: string;
    onApply: (template: unknown) => void;
  }) => (
    <button
      type="button"
      data-project-id={projectId}
      data-workspace={workspaceSlug}
      data-kind={kind}
      onClick={() =>
        onApply({
          title: "Page template title",
          description_html: "<p>Page template body</p>",
          configuration: { logo_props: mocks.logo },
        })
      }
    >
      Apply test template
    </button>
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.logo = undefined;
});

const mount = () =>
  render(
    <Dialog open>
      <DialogContent>
        <PageForm
          projectId="destination-project"
          formData={{ name: "", logo_props: { in_use: "emoji", emoji: { value: "128196" } } }}
          handleFormData={mocks.handleFormData}
          handleModalClose={vi.fn()}
          handleFormSubmit={vi.fn().mockResolvedValue(undefined)}
        />
      </DialogContent>
    </Dialog>
  );

it("uses the actual destination project and applies page content and logo", () => {
  mocks.logo = { in_use: "icon", icon: { name: "File", color: "#123456" } };
  mount();
  const apply = screen.getByRole("button", { name: "Apply test template" });
  expect(apply.getAttribute("data-project-id")).toBe("destination-project");
  expect(apply.getAttribute("data-workspace")).toBe("workspace");
  expect(apply.getAttribute("data-kind")).toBe("page");
  fireEvent.click(apply);
  expect(mocks.handleFormData.mock.calls).toEqual([
    ["name", "Page template title"],
    ["description_html", "<p>Page template body</p>"],
    ["logo_props", mocks.logo],
  ]);
});

it("keeps the chosen page logo when applying a legacy template", () => {
  mount();
  fireEvent.click(screen.getByRole("button", { name: "Apply test template" }));
  expect(mocks.handleFormData.mock.calls).toEqual([
    ["name", "Page template title"],
    ["description_html", "<p>Page template body</p>"],
  ]);
});
