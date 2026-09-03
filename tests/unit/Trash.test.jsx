// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import Trash from "../../src/views/Trash.jsx";

afterEach(cleanup);

const boards = [
  { id: "b1", title: "Old case", updatedAt: Date.now(), nodes: [], edges: [] },
];

const base = {
  boards, accent: "#e5231b", themeName: "light", onToggleTheme: vi.fn(), onCreate: vi.fn(),
  onSignOut: vi.fn(), onBack: vi.fn(), onRestore: vi.fn(), onPurge: vi.fn(), creating: false,
};

describe("Trash", () => {
  it("lists trashed boards", () => {
    render(<Trash {...base} />);
    expect(screen.getByText("Old case")).toBeInTheDocument();
    expect(screen.getByText("1 item")).toBeInTheDocument();
  });

  it("shows the empty state when there are no trashed boards", () => {
    render(<Trash {...base} boards={[]} />);
    expect(screen.getByText("Trash is empty.")).toBeInTheDocument();
  });

  it("calls onRestore with the board when Restore is clicked", () => {
    render(<Trash {...base} />);
    fireEvent.click(screen.getByText("Restore"));
    expect(base.onRestore).toHaveBeenCalledWith(boards[0]);
  });

  it("calls onPurge with the board when Delete forever is clicked", () => {
    render(<Trash {...base} />);
    fireEvent.click(screen.getByText("Delete forever"));
    expect(base.onPurge).toHaveBeenCalledWith(boards[0]);
  });

  it("calls onBack when the trash/back header button is clicked", () => {
    render(<Trash {...base} />);
    fireEvent.click(screen.getByTitle("Back to boards"));
    expect(base.onBack).toHaveBeenCalled();
  });
});
