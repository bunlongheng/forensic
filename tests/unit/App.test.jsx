// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
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
  default: ({ board, onBack }) => (
    <div>
      <div>{`Board view: ${board?.title}`}</div>
      <button onClick={onBack}>Back to gallery</button>
    </div>
  ),
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

  // Returning to the gallery refetches in the background: the cards already on
  // screen stay put instead of being blanked into the loading skeleton, which
  // only the very first load shows.
  it("does not render the skeleton on a second visit to the gallery", async () => {
    Object.defineProperty(window, "location", { configurable: true, value: new URL("http://localhost/") });
    // Opening a board writes ?id= via replaceState; jsdom's real document origin
    // doesn't match the mocked location above, so stub it out.
    vi.spyOn(window.history, "replaceState").mockImplementation(() => {});
    mockAuth(false);
    const rows = [{ id: "b1", title: "Case Alpha", nodes: [], edges: [], updated_at: Date.now() }];
    // The refetch on the way back is held open, so the assertions land while it
    // is still in flight - exactly the window the skeleton used to fill.
    let landSecondFetch;
    listBoards
      .mockResolvedValueOnce(rows)
      .mockImplementationOnce(() => new Promise((resolve) => { landSecondFetch = () => resolve(rows); }));
    getBoard.mockResolvedValue({ id: "b1", title: "Case Alpha", nodes: [], edges: [] });

    const { container } = render(<App />);
    await waitFor(() => expect(screen.getByText("Case Alpha")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Case Alpha" }));
    await waitFor(() => expect(screen.getByText("Board view: Case Alpha")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Back to gallery"));
    await waitFor(() => expect(listBoards).toHaveBeenCalledTimes(2));

    // The refetch is still pending: the old cards are on screen, no skeleton.
    expect(container.querySelector(".fx-skeleton")).toBeNull();
    expect(screen.getByText("Case Alpha")).toBeInTheDocument();

    await act(async () => { landSecondFetch(); });
    expect(container.querySelector(".fx-skeleton")).toBeNull();
    expect(screen.getByText("Case Alpha")).toBeInTheDocument();
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

  it("renders the denied sign-in message on the sign-in screen itself, not just a toast", async () => {
    Object.defineProperty(window, "location", { configurable: true, value: new URL("https://app.example.com/?auth=denied") });
    // App strips the ?auth param via history.replaceState once it has read it; jsdom's
    // real document origin doesn't match the mocked location above, so stub it out -
    // only the message rendering is under test here, not the URL cleanup.
    vi.spyOn(window.history, "replaceState").mockImplementation(() => {});
    mockAuth(false);

    render(<App />);

    await waitFor(() => expect(screen.getByText("That Google account is not authorized")).toBeInTheDocument());
  });

  it("shows a retry banner (not a silent sign-out) when the auth probe itself fails", async () => {
    Object.defineProperty(window, "location", { configurable: true, value: new URL("https://app.example.com/") });
    global.fetch = vi.fn().mockImplementation((url) => {
      if (String(url).includes("/api/auth/me")) return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    render(<App />);

    await waitFor(() => expect(screen.getByText(/Couldn't check your sign-in status/)).toBeInTheDocument());
    fireEvent.click(screen.getByText("Retry"));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith("/api/auth/me"));
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
