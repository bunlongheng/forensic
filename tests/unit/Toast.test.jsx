// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { Toast } from "../../src/components/Toast.jsx";

afterEach(cleanup);

describe("Toast", () => {
  it("renders the message text when visible", () => {
    render(<Toast message="Saved!" visible={true} />);
    expect(screen.getByText("Saved!")).toBeInTheDocument();
  });

  it("has role='status'", () => {
    render(<Toast message="Saved!" visible={true} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
