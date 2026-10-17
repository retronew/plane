import { describe, expect, it } from "vitest";
import {
  activeCustomProperties,
  customPropertyDefaults,
  customPropertyErrors,
  customPropertyPayload,
} from "./custom-properties";
import type { TCustomProperty } from "@/services/project/custom-properties.types";

export const property = (patch: Partial<TCustomProperty> = {}): TCustomProperty => ({
  id: "p",
  name: "Property",
  description: "",
  property_type: "text",
  config: {},
  is_active: true,
  is_required: false,
  sort_order: 0,
  options: [],
  type_settings: [],
  ...patch,
});

describe("custom property runtime rules", () => {
  it("filters global and effective inactive bindings, then orders without mutating the response", () => {
    const input = [
      property({ id: "later", sort_order: 5 }),
      property({ id: "off", effective_is_active: false }),
      property({ id: "global-off", is_active: false, effective_is_active: true }),
      property({ id: "first" }),
    ];
    expect(activeCustomProperties(input).map((item) => item.id)).toEqual(["first", "later"]);
    expect(input[0].id).toBe("later");
  });
  it("accepts zero and false while rejecting empty required values", () => {
    const required = property({ is_required: true });
    expect(customPropertyErrors([required], { p: false })).toEqual({});
    expect(customPropertyErrors([required], { p: 0 })).toEqual({});
    for (const value of [null, "  ", []])
      expect(customPropertyErrors([required], { p: value })).toEqual({ p: "required" });
    expect(customPropertyErrors([property({ is_required: true, effective_is_required: false })], {})).toEqual({});
  });
  it("keeps defaults typed and excludes unbound and read-only keys from submissions", () => {
    const properties = [
      property({ config: { default_value: 0 } }),
      property({ id: "ro", config: { default_value: "fixed", read_only: true } }),
    ];
    expect(customPropertyDefaults(properties)).toEqual({ p: 0, ro: "fixed" });
    expect(customPropertyPayload(properties, { p: null, ro: "fixed", hidden: "retain locally" })).toEqual({ p: null });
  });
  it("validates finite numbers and http urls", () => {
    expect(customPropertyErrors([property({ property_type: "number" })], { p: Number.NaN })).toEqual({
      p: "invalid_number",
    });
    expect(customPropertyErrors([property({ property_type: "url" })], { p: "javascript:alert(1)" })).toEqual({
      p: "invalid_url",
    });
    expect(customPropertyErrors([property({ property_type: "url" })], { p: "https://example.com" })).toEqual({});
  });
});
