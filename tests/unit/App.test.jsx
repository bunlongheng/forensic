// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";

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

// The canvas (React Flow) is by far the heaviest chunk to mount and isn't what
// these tests exercise - stub it out so opening a board stays cheap and jsdom
// never has to deal with React Flow's layout measuring.
vi.mock("../../src/views/Board.jsx", () => ({
  default: ({ board }) => <div>{`Board view: ${board?.title}`}</div>,
}));

import App from "../../src/App.jsx";
import { listBoards, getBoard, deleteBoard, listTrash, restoreBoard } from "../../src/lib/api.js";

function mockAuth(authenticated = false) {
  global.fetch = vi.fn().mockImplementation((url) => {
    if (String(url).includes("/api/auth/me")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ authenticated }) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  listBoards.mockResolvedValue([]);
  listTrash.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("App", () => {
  it("renders the sign-in screen when /api/auth/me says authenticated:false and there is no ?id", async () => {
    // Non-localhost host so the dev-bypass (which auto-enables editing on localhost)
    // stays off and the real sign-in screen renders.
    Object.defineProperty(window, "location", { configurable: true, value: new URL("https://app.example.com/") });
    mockAuth(false);

    render(<App />);

    await waitFor(() => expect(screen.getByText("FORENSIC")).toBeInTheDocument());
    expect(screen.getByText("Continue with Google")).toBeInTheDocument();
  });

  it("renders the board view for a ?id= deep link", async () => {
    Object.defineProperty(window, "location", { configurable: true, value: new URL("https://app.example.com/?id=b1") });
    mockAuth(false);
    getBoard.mockResolvedValue({ id: "b1", title: "Case Deep Link", nodes: [], edges: [] });

    render(<App />);

    await waitFor(() => expect(screen.getByText("Board view: Case Deep Link")).toBeInTheDocument());
  });

  it("shows 'Board not found' when getBoard 404s for a ?id= deep link", async () => {
    Object.defineProperty(window, "location", { configurable: true, value: new URL("https://app.example.com/?id=missing") });
    mockAuth(false);
    getBoard.mockRejectedValue(new Error("HTTP 404"));

    render(<App />);

    await waitFor(() => expect(screen.getByText("Board not found")).toBeInTheDocument());
  });

  it("lists boards from listBoards on localhost", async () => {
    Object.defineProperty(window, "location", { configurable: true, value: new URL("http://localhost/") });
    mockAuth(false);
    listBoards.mockResolvedValue([{ id: "b1", title: "Case Alpha", nodes: [], edges: [], updated_at: Date.now() }]);

    render(<App />);

    await waitFor(() => expect(screen.getByText("Case Alpha")).toBeInTheDocument());
  });

  it("does not call deleteBoard when the confirm dialog is cancelled", async () => {
    Object.defineProperty(window, "location", { configurable: true, value: new URL("http://localhost/") });
    mockAuth(false);
    listBoards.mockResolvedValue([{ id: "b1", title: "Case Alpha", nodes: [], edges: [], updated_at: Date.now() }]);
    vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<App />);

    await waitFor(() => expect(screen.getByText("Case Alpha")).toBeInTheDocument());
    fireEvent.click(screen.getByTitle("Delete board"));
    expect(deleteBoard).not.toHaveBeenCalled();
  });

  it("lists trashed boards and calls restoreBoard when Restore is clicked", async () => {
    Object.defineProperty(window, "location", { configurable: true, value: new URL("http://localhost/") });
    mockAuth(false);
    listBoards.mockResolvedValue([]);
    listTrash.mockResolvedValue([{ id: "t1", title: "Old case", nodes: [], edges: [], updated_at: Date.now() }]);
    restoreBoard.mockResolvedValue({});

    render(<App />);

    await waitFor(() => expect(screen.getByTitle("Trash")).toBeInTheDocument());
    fireEvent.click(screen.getByTitle("Trash"));

    await waitFor(() => expect(screen.getByText("Old case")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Restore"));
    expect(restoreBoard).toHaveBeenCalledWith("t1");
  });
});
