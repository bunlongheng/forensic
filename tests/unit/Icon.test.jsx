// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { Icon } from "../../src/components/Icon.jsx";

afterEach(cleanup);

describe("Icon", () => {
  it("renders an svg for a known name", () => {
    const { container } = render(<Icon name="trash" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("width", "17");
    expect(svg.querySelector("path")).toBeInTheDocument();
  });
});
