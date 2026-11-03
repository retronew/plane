import { describe, expect, it } from "vitest";
import type { ClientLoaderFunctionArgs } from "react-router";
import { clientLoader as login } from "./login";
import { clientLoader as signIn } from "./sign-in";
import { clientLoader as signin } from "./signin";

describe.each([login, signIn, signin])("legacy login return address", (loader) => {
  it("preserves the encoded destination and auth query parameters", () => {
    const nextPath = "/wuzuo/projects/project/issues/?peekId=issue&filter=a%26b#description";
    const search = new URLSearchParams({ next_path: nextPath, error_code: "test" });
    try {
      loader({ request: new Request(`https://plane.test/login/?${search}`) } as ClientLoaderFunctionArgs);
      expect.fail("Expected a redirect");
    } catch (response) {
      expect(response).toBeInstanceOf(Response);
      const target = new URL((response as Response).headers.get("Location")!, "https://plane.test");
      expect(target.pathname).toBe("/");
      expect(target.searchParams.get("next_path")).toBe(nextPath);
      expect(target.searchParams.get("error_code")).toBe("test");
    }
  });
});
