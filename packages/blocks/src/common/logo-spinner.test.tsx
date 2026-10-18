import { render } from "@testing-library/react";
import { expect, it } from "vitest";
import { LogoSpinner } from "./logo-spinner";

it("renders both theme variants and lets the theme class pick one", () => {
  const { container } = render(<LogoSpinner lightSrc="/light.gif" darkSrc="/dark.gif" />);

  const images = [...container.querySelectorAll("img")];
  expect(images).toHaveLength(2);
  expect(images.map((image) => image.getAttribute("src"))).toEqual(["/light.gif", "/dark.gif"]);
  // The variants are swapped by CSS, not by JS, so the markup matches before hydration.
  expect(images[0].className).toContain("dark:hidden");
  expect(images[1].className).toContain("dark:block");
  expect(images.every((image) => image.getAttribute("alt") === "logo")).toBe(true);
});
