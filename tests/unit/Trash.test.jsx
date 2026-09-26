// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import Trash from "../../src/views/Trash.jsx";

afterEach(cleanup);

const board = (id, title) => ({ id, title, nodes: [], edges: [], updatedAt: new Date().toISOString() });
const base = {
  accent: "#d92b1f", themeName: "light", onToggleTheme: vi.fn(), onCreate: vi.fn(),
  onSignOut: vi.fn(), onBack: vi.fn(), onRestore: vi.fn(), onPurge: vi.fn(), onEmpty: vi.fn(),
};

describe("Trash", () => {
  it("offers Empty trash when there is something in it", () => {
    render(<Trash {...base} boards={[board("a", "One"), board("b", "Two")]} />);
    expect(screen.getByRole("button", { name: "Empty trash" })).toBeInTheDocument();
  });

  it("calls onEmpty when it is clicked", () => {
    const onEmpty = vi.fn();
    render(<Trash {...base} onEmpty={onEmpty} boards={[board("a", "One")]} />);
    fireEvent.click(screen.getByRole("button", { name: "Empty trash" }));
    expect(onEmpty).toHaveBeenCalled();
  });

  it("never renders a dead Empty trash over an empty list", () => {
    render(<Trash {...base} boards={[]} />);
    expect(screen.queryByRole("button", { name: "Empty trash" })).not.toBeInTheDocument();
    expect(screen.getByText("Trash is empty.")).toBeInTheDocument();
  });

  it("hides it while loading or errored, so it cannot act on a list that is not there", () => {
    const { rerender } = render(<Trash {...base} boards={[board("a", "One")]} loading />);
    expect(screen.queryByRole("button", { name: "Empty trash" })).not.toBeInTheDocument();
    rerender(<Trash {...base} boards={[board("a", "One")]} error="Could not load the trash" />);
    expect(screen.queryByRole("button", { name: "Empty trash" })).not.toBeInTheDocument();
  });

  it("marks the trashed card wrapper inert so it is not focusable, while Restore stays reachable", () => {
    render(<Trash {...base} boards={[board("a", "One")]} />);
    const restore = screen.getByRole("button", { name: "Restore" });
    expect(restore).toBeInTheDocument();
    expect(restore.parentElement.previousElementSibling).toHaveAttribute("inert");
  });

  it("shows progress and disables itself mid-empty, so it cannot be double-fired", () => {
    const onEmpty = vi.fn();
    render(<Trash {...base} onEmpty={onEmpty} emptying boards={[board("a", "One")]} />);
    const btn = screen.getByRole("button", { name: "Emptying…" });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onEmpty).not.toHaveBeenCalled();
  });
});
