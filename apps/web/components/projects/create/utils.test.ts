import { expect, it } from "vitest";
import { getProjectFormValues } from "./utils";

it("starts with no cover asset so creation does not upload a random image", () => {
  const first = getProjectFormValues();
  const second = getProjectFormValues();
  expect(first.cover_image_url).toBe("");
  expect(second.cover_image_url).toBe("");
  expect(first).toMatchObject({ name: "", identifier: "", network: 2, project_lead: null });
});
