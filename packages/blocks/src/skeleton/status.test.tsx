import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Skeleton } from "./root";
import { Loader } from "./loader";
import { Spinner } from "../spinner/circular-spinner";
import { CircularBarSpinner } from "../spinner/circular-bar-spinner";

describe("loading status semantics", () => {
  it("keeps block layout and implicit status semantics", () => {
    render(
      <>
        <Skeleton ariaLabel="Loading projects">
          <Skeleton.Item />
        </Skeleton>
        <Loader>
          <Loader.Item />
        </Loader>
        <Spinner />
        <CircularBarSpinner />
      </>
    );
    expect(screen.getByRole("status", { name: "Loading projects" })).toBeDefined();
    const statuses = screen.getAllByRole("status");
    expect(statuses).toHaveLength(4);
    for (const status of statuses) {
      expect(status.tagName).toBe("OUTPUT");
      expect(status.classList.contains("block")).toBe(true);
    }
  });
});
