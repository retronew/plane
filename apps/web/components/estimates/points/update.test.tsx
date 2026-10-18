import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { EEstimateSystem } from "@plane/constants";
import { EstimatePointUpdate } from "./update";
const mocks = vi.hoisted(() => ({ updateEstimatePoint: vi.fn() }));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@/hooks/store/estimates/use-estimate-point", () => ({ useEstimatePoint: () => mocks }));
vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  translate: (key: string) => key,
}));
vi.mock("@plane/blocks/toast", () => ({ setToast: vi.fn() }));
vi.mock("@/components/estimates/inputs/root", () => ({
  EstimateInputRoot: ({
    value,
    handleEstimateInputValue,
  }: {
    value: string;
    handleEstimateInputValue: (value: string) => void;
  }) => <input value={value} onChange={(event) => handleEstimateInputValue(event.target.value)} />,
}));
beforeEach(() => {
  mocks.updateEstimatePoint.mockReset().mockResolvedValue({});
});
it("loads a new target's value and ignores the old target's pending completion", async () => {
  let finish!: () => void;
  mocks.updateEstimatePoint.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      })
  );
  const close = vi.fn();
  const error = vi.fn();
  const props: ComponentProps<typeof EstimatePointUpdate> = {
    workspaceSlug: "test",
    projectId: "project",
    estimateId: "estimate",
    estimatePointId: "a",
    estimateType: EEstimateSystem.POINTS,
    estimatePoints: [],
    estimatePoint: { key: 1, value: "1" },
    handleEstimatePointValueUpdate: vi.fn(),
    closeCallBack: close,
    handleEstimatePointError: error,
  };
  const { rerender, container } = render(<EstimatePointUpdate {...props} />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "3" } });
  fireEvent.submit(container.querySelector("form")!);
  fireEvent.submit(container.querySelector("form")!);
  expect(mocks.updateEstimatePoint).toHaveBeenCalledOnce();
  rerender(<EstimatePointUpdate {...props} estimatePointId="b" estimatePoint={{ key: 2, value: "2" }} />);
  expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("2");
  error.mockClear();
  await act(async () => finish());
  expect(close).not.toHaveBeenCalled();
  expect(error).not.toHaveBeenCalled();
});
