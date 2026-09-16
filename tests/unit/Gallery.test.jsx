// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import Gallery from "../../src/views/Gallery.jsx";

afterEach(cleanup);

const boards = [
  { id: "b1", title: "Case Alpha", updatedAt: Date.now(), nodes: [], edges: [] },
  { id: "b2", title: "Case Beta", updatedAt: Date.now(), nodes: [], edges: [] },
];

const base = {
  boards, accent: "#e5231b", themeName: "light", onToggleTheme: vi.fn(), onOpen: vi.fn(),
  onCreate: vi.fn(), onDelete: vi.fn(), onSignOut: vi.fn(), onOpenTrash: vi.fn(), trashCount: 2, creating: false,
};

describe("Gallery", () => {
  it("renders a board card per board", () => {
    render(<Gallery {...base} />);
    expect(screen.getByText("Case Alpha")).toBeInTheDocument();
    expect(screen.getByText("Case Beta")).toBeInTheDocument();
    expect(screen.getByText("2 total")).toBeInTheDocument();
  });

  it("shows the empty state when there are no boards", () => {
    render(<Gallery {...base} boards={[]} />);
    expect(screen.getByText(/No boards yet/)).toBeInTheDocument();
  });

  it("filters boards by search text", () => {
    render(<Gallery {...base} />);
    fireEvent.change(screen.getByPlaceholderText("Search boards"), { target: { value: "beta" } });
    expect(screen.getByText("Case Beta")).toBeInTheDocument();
    expect(screen.queryByText("Case Alpha")).not.toBeInTheDocument();
  });

  it("shows New board straight away - it used to hide behind a Cmd+click on the brand", () => {
    render(<Gallery {...base} />);
    expect(screen.getByTitle("New board")).toBeInTheDocument();
  });

  it("clicking the brand goes home rather than toggling anything", () => {
    render(<Gallery {...base} />);
    fireEvent.click(screen.getByTitle("Your boards"));
    expect(screen.getByTitle("New board")).toBeInTheDocument();
  });

  it("calls onCreate when New board is clicked", () => {
    render(<Gallery {...base} />);
    fireEvent.click(screen.getByTitle("New board"));
    expect(base.onCreate).toHaveBeenCalled();
  });

  it("calls onOpenTrash when the Trash button is clicked", () => {
    render(<Gallery {...base} />);
    fireEvent.click(screen.getByTitle("Trash"));
    expect(base.onOpenTrash).toHaveBeenCalled();
  });

  it("calls onSignOut when Sign out is clicked", () => {
    render(<Gallery {...base} />);
    fireEvent.click(screen.getByTitle("Sign out"));
    expect(base.onSignOut).toHaveBeenCalled();
  });

  it("calls onToggleTheme when the theme button is clicked", () => {
    render(<Gallery {...base} />);
    fireEvent.click(screen.getByTitle("Toggle theme"));
    expect(base.onToggleTheme).toHaveBeenCalled();
  });

  it("shows a skeleton grid and no board cards while loading", () => {
    const { container } = render(<Gallery {...base} boards={[]} loading />);
    expect(container.querySelectorAll(".fx-skeleton").length).toBe(6);
    expect(screen.queryByText("Case Alpha")).not.toBeInTheDocument();
    expect(screen.queryByText(/No boards yet/)).not.toBeInTheDocument();
  });

  it("shows an error card with a Retry button and calls onRetry when clicked", () => {
    const onRetry = vi.fn();
    render(<Gallery {...base} boards={[]} error="Could not load boards" onRetry={onRetry} />);
    expect(screen.getByText("Could not load boards")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Retry"));
    expect(onRetry).toHaveBeenCalled();
  });

  it("shows the real empty state only when not loading and not errored", () => {
    render(<Gallery {...base} boards={[]} />);
    expect(screen.getByText(/No boards yet/)).toBeInTheDocument();
  });
});
