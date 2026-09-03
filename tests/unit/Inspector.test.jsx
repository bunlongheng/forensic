// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { Inspector } from "../../src/components/Inspector.jsx";

afterEach(cleanup);

describe("Inspector", () => {
  it("shows note controls and calls onNode with a sticky color patch", () => {
    const onNode = vi.fn();
    render(<Inspector kind="note" data={{}} onNode={onNode} />);
    expect(screen.getByText("Note")).toBeInTheDocument();
    expect(screen.getByText("Sticky color")).toBeInTheDocument();
    fireEvent.click(screen.getByTitle("#fef3c7"));
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
    fireEvent.click(screen.getByTitle("#2f6fed"));
    expect(onEdge).toHaveBeenCalledWith({ color: "#2f6fed" });
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
});
