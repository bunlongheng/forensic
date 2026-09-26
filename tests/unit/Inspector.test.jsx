// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { Inspector } from "../../src/components/Inspector.jsx";
import { NODE_REGISTRY } from "../../src/lib/nodeRegistry.js";

afterEach(cleanup);

describe("Inspector", () => {
  it("shows note controls and calls onNode with a sticky color patch", () => {
    const onNode = vi.fn();
    render(<Inspector kind="note" data={{}} onNode={onNode} />);
    expect(screen.getByText("Note")).toBeInTheDocument();
    expect(screen.getByText("Sticky color")).toBeInTheDocument();
    fireEvent.click(screen.getByTitle("Butter yellow"));
    expect(onNode).toHaveBeenCalledWith({ variant: "sticky", color: "#fef3c7" });
  });

  it("shows image style controls and calls onNode with a style patch", () => {
    const onNode = vi.fn();
    render(<Inspector kind="image" data={{}} onNode={onNode} />);
    expect(screen.getByText("Photo")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Newspaper"));
    expect(onNode).toHaveBeenCalledWith({ style: "newspaper", grayscale: undefined, wrinkle: undefined });
  });

  it("shows edge thread colors and calls onEdge with a color patch", () => {
    const onEdge = vi.fn();
    render(<Inspector kind="edge" data={{}} onEdge={onEdge} />);
    expect(screen.getByText("Thread")).toBeInTheDocument();
    expect(screen.getByText("Thread color")).toBeInTheDocument();
    fireEvent.click(screen.getByTitle("Blue"));
    expect(onEdge).toHaveBeenCalledWith({ color: "#2f6fed" });
  });

  it("gives each toggle switch an accessible name so it is reachable by role", () => {
    render(<Inspector kind="note" data={{}} onNode={vi.fn()} />);
    const pinSwitch = screen.getByRole("switch", { name: /pin/i });
    expect(pinSwitch).toHaveAttribute("aria-checked", "false");
  });

  it("names swatches for screen readers instead of exposing the raw hex", () => {
    render(<Inspector kind="note" data={{}} onNode={vi.fn()} />);
    const swatch = screen.getByTitle("Butter yellow");
    expect(swatch).toHaveAttribute("aria-label", "Butter yellow");
    expect(swatch).toHaveAttribute("aria-pressed", "false");
  });

  it("marks the active Paper segment, emoji and border-only button as pressed", () => {
    render(<Inspector kind="note" data={{ variant: "clean" }} onNode={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Paper" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Rip" })).toHaveAttribute("aria-pressed", "false");

    cleanup();
    render(<Inspector kind="sticker" data={{ emoji: "🔥" }} onNode={vi.fn()} />);
    expect(screen.getByTitle("🔥")).toHaveAttribute("aria-pressed", "true");

    cleanup();
    render(<Inspector kind="profile" data={{ color: "outline" }} onNode={vi.fn()} />);
    expect(screen.getByTitle("Border only")).toHaveAttribute("aria-pressed", "true");
  });

  it("shows the Ungroup button for containers and fires onUngroup", () => {
    const onUngroup = vi.fn();
    render(<Inspector kind="container" data={{}} onNode={vi.fn()} onUngroup={onUngroup} />);
    fireEvent.click(screen.getByText("Ungroup"));
    expect(onUngroup).toHaveBeenCalled();
  });

  it("shows the Arrange row and calls onArrange with front/back", () => {
    const onArrange = vi.fn();
    render(<Inspector kind="note" data={{}} onNode={vi.fn()} onArrange={onArrange} />);
    fireEvent.click(screen.getByText("To front"));
    expect(onArrange).toHaveBeenCalledWith("front");
    fireEvent.click(screen.getByText("To back"));
    expect(onArrange).toHaveBeenCalledWith("back");
  });

  it("does not show the Arrange row for edges", () => {
    render(<Inspector kind="edge" data={{}} onEdge={vi.fn()} onArrange={vi.fn()} />);
    expect(screen.queryByText("To front")).not.toBeInTheDocument();
  });

  // The other half of the registry contract (tests/unit/nodeRegistry.test.js
  // owns the first): every declared type must actually open a panel, so a type
  // can never render on the board with nothing to edit it.
  it.each(Object.keys(NODE_REGISTRY))("opens a panel for every registry type: %s", (kind) => {
    const { container } = render(
      <Inspector kind={kind} data={{ kind: "pdf" }} onNode={vi.fn()} onEdge={vi.fn()} onArrange={vi.fn()} onUngroup={vi.fn()} />,
    );
    // The heading is the registry's own label (the file card names itself after
    // what it holds, so it is the one type whose title is not the raw label).
    const head = container.querySelector(".mono");
    expect(head.textContent).toBe(kind === "file" ? "PDF" : NODE_REGISTRY[kind].label);
    // Arrange (2 buttons) plus at least 1 control from the type's own panel.
    expect(container.querySelectorAll("button").length).toBeGreaterThan(2);
  });
});
