// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import SignInScreen from "../../src/components/SignInScreen.jsx";

afterEach(cleanup);

describe("SignInScreen", () => {
  it("renders FORENSIC and a Continue with Google link to /api/auth/login when not loading", () => {
    render(<SignInScreen />);
    expect(screen.getByText("FORENSIC")).toBeInTheDocument();
    const link = screen.getByText("Continue with Google").closest("a");
    expect(link).toHaveAttribute("href", "/api/auth/login");
  });

  it("does not render the card while loading", () => {
    render(<SignInScreen loading />);
    expect(screen.queryByText("FORENSIC")).not.toBeInTheDocument();
    expect(screen.queryByText("Continue with Google")).not.toBeInTheDocument();
  });
});
