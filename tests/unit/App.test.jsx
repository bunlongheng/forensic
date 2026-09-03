// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";

vi.mock("../../src/lib/api.js", () => ({
  listBoards: vi.fn().mockResolvedValue([]),
  getBoard: vi.fn(),
  createBoard: vi.fn(),
  updateBoard: vi.fn(),
  deleteBoard: vi.fn(),
  listTrash: vi.fn().mockResolvedValue([]),
  restoreBoard: vi.fn(),
  purgeBoard: vi.fn(),
}));

import App from "../../src/App.jsx";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("App", () => {
  it("renders the sign-in screen when /api/auth/me says authenticated:false and there is no ?id", async () => {
    // Non-localhost host so the dev-bypass (which auto-enables editing on localhost)
    // stays off and the real sign-in screen renders.
    Object.defineProperty(window, "location", { configurable: true, value: new URL("https://app.example.com/") });
    global.fetch = vi.fn().mockImplementation((url) => {
      if (String(url).includes("/api/auth/me")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ authenticated: false }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    render(<App />);

    await waitFor(() => expect(screen.getByText("FORENSIC")).toBeInTheDocument());
    expect(screen.getByText("Continue with Google")).toBeInTheDocument();
  });
});
