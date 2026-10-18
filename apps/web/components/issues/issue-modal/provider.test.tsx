import { act, render, screen, waitFor } from "@testing-library/react";
import { useContext, useEffect } from "react";
import { SWRConfig } from "swr";
import { beforeEach, expect, it, vi } from "vitest";
import { IssueModalProvider } from "./provider";
import { IssueModalContext } from "./context";

const mocks = vi.hoisted(() => ({ list: vi.fn(), values: vi.fn(), toast: vi.fn() }));
vi.mock("@/services/project/custom-properties.service", () => ({
  CustomPropertiesService: class {
    list = mocks.list;
    values = mocks.values;
  },
}));
vi.mock("@/hooks/store/user/user-user", () => ({ useUser: () => ({ projectsWithCreatePermissions: { p: true } }) }));
vi.mock("@plane/i18n", () => {
  const t = (key: string) => key;
  return { useTranslation: () => ({ t }) };
});
vi.mock("@plane/blocks/toast", () => ({ setToast: mocks.toast }));
let context: NonNullable<React.ContextType<typeof IssueModalContext>>;
function Consumer({
  typeId,
  projectId = "p",
  isDraft = false,
}: {
  typeId: string;
  projectId?: string;
  isDraft?: boolean;
}) {
  const currentContext = useContext(IssueModalContext)!;
  useEffect(() => {
    context = currentContext;
  }, [currentContext]);
  const fetch = currentContext.handleProjectEntitiesFetch;
  useEffect(() => {
    void fetch({ workspaceSlug: "w", workItemProjectId: projectId, workItemTypeId: typeId, isDraft });
  }, [fetch, typeId, projectId, isDraft]);
  return <div>{currentContext.customProperties.map((p) => p.id).join(",")}</div>;
}
function TestProvider({
  typeId,
  projectId,
  isDraft,
  data,
}: {
  typeId: string;
  projectId?: string;
  isDraft?: boolean;
  data?: import("@plane/types").TIssue;
}) {
  return (
    <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}>
      <IssueModalProvider dataForPreload={data}>
        <Consumer typeId={typeId} projectId={projectId} isDraft={isDraft} />
      </IssueModalProvider>
    </SWRConfig>
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.list.mockImplementation(async (_w, _p, type) => ({
    results: [
      {
        id: type,
        name: type,
        property_type: "number",
        is_active: true,
        effective_is_active: true,
        is_required: true,
        sort_order: 0,
        config: {},
        options: [],
      },
    ],
    count: 1,
    can_manage: true,
  }));
});
it("blocks empty required creation, accepts zero, and submits only current bindings after a type change", async () => {
  const view = render(<TestProvider typeId="bug" />);
  await screen.findByText("bug");
  let payload;
  act(() => {
    payload = context.prepareCustomProperties("p", "w", "bug");
  });
  expect(payload).toBeNull();
  expect(context.customPropertyErrors).toEqual({ bug: "required" });
  act(() => context.setCustomPropertyValues({ bug: 0 }));
  act(() => {
    payload = context.prepareCustomProperties("p", "w", "bug");
  });
  expect(payload).toEqual({ bug: 0 });
  view.rerender(<TestProvider typeId="task" />);
  await screen.findByText("task");
  expect(context.customPropertyValues.bug).toBe(0);
  act(() => context.setCustomPropertyValues((current) => ({ ...current, task: 2 })));
  act(() => {
    payload = context.prepareCustomProperties("p", "w", "task");
  });
  expect(payload).toEqual({ task: 2 });
});
it("blocks submit while definitions fail, retains entered values, and retries", async () => {
  mocks.list.mockRejectedValueOnce(new Error("offline"));
  render(<TestProvider typeId="bug" />);
  await waitFor(() => expect(context.customPropertiesError).toBeTruthy());
  act(() => context.setCustomPropertyValues({ bug: 4 }));
  let payload;
  act(() => {
    payload = context.prepareCustomProperties("p", "w", "bug");
  });
  expect(payload).toBeNull();
  act(() => context.retryCustomProperties());
  await screen.findByText("bug");
  act(() => {
    payload = context.prepareCustomProperties("p", "w", "bug");
  });
  expect(payload).toEqual({ bug: 4 });
});

it("allows creation with an empty schema and clears values when changing project", async () => {
  mocks.list.mockResolvedValue({ results: [], count: 0, can_manage: false });
  const view = render(<TestProvider typeId="bug" />);
  await waitFor(() => expect(context.customPropertiesLoading).toBe(false));
  let payload;
  act(() => {
    payload = context.prepareCustomProperties("p", "w", "bug");
  });
  expect(payload).toEqual({});
  act(() => context.setCustomPropertyValues({ old: "do not leak" }));
  view.rerender(<TestProvider typeId="bug" projectId="other" />);
  await waitFor(() => expect(context.customPropertyContext).toBe("w:other:bug"));
  expect(context.customPropertyValues).toEqual({});
});

it("does not overwrite a new input when an existing issue's preload completes", async () => {
  let resolve!: (value: { values: Record<string, number> }) => void;
  mocks.values.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    })
  );
  const data = { id: "i", project_id: "p" } as import("@plane/types").TIssue;
  render(<TestProvider typeId="bug" data={data} />);
  await screen.findByText("bug");
  act(() => context.setCustomPropertyValues({ bug: 9 }));
  await act(async () => resolve({ values: { bug: 1, other: 2 } }));
  expect(context.customPropertyValues).toEqual({ bug: 9, other: 2 });
});

it("loads draft values from its payload and never calls the issue values endpoint with a draft UUID", async () => {
  const data = {
    id: "draft",
    project_id: "p",
    custom_properties: { bug: 3 },
  } as unknown as import("@plane/types").TIssue;
  render(<TestProvider typeId="bug" data={data} isDraft />);
  await screen.findByText("bug");
  expect(mocks.values).not.toHaveBeenCalled();
  let payload;
  act(() => {
    payload = context.prepareCustomProperties("p", "w", "bug");
  });
  expect(payload).toEqual({ bug: 3 });
});

it("preserves the context value when only the provider parent rerenders", async () => {
  const view = render(<TestProvider typeId="bug" />);
  // Schema arrival also schedules a defaults effect. Flush that state update before
  // comparing identities, so this measures a parent render rather than schema loading.
  await act(async () => {
    await screen.findByText("bug");
  });
  const previousContext = context;
  view.rerender(<TestProvider typeId="bug" />);
  expect(context).toBe(previousContext);
});
