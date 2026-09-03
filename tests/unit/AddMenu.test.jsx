// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { AddMenu } from "../../src/components/AddMenu.jsx";

afterEach(cleanup);

describe("AddMenu", () => {
  it("opens the ring on click and shows the add items", () => {
    render(<AddMenu onAdd={vi.fn()} onAddImage={vi.fn()} />);
    fireEvent.click(screen.getByTitle("Add to board"));
    expect(screen.getByTitle("Text")).toBeInTheDocument();
    expect(screen.getByTitle("Group")).toBeInTheDocument();
  });

  it("calls onAdd with the item key for a plain item", () => {
    const onAdd = vi.fn();
    render(<AddMenu onAdd={onAdd} onAddImage={vi.fn()} />);
    fireEvent.click(screen.getByTitle("Add to board"));
    fireEvent.click(screen.getByTitle("Text"));
    expect(onAdd).toHaveBeenCalledWith("text");
  });

  it("calls onAdd with container key for the Group item", () => {
    const onAdd = vi.fn();
    render(<AddMenu onAdd={onAdd} onAddImage={vi.fn()} />);
    fireEvent.click(screen.getByTitle("Add to board"));
    fireEvent.click(screen.getByTitle("Group"));
    expect(onAdd).toHaveBeenCalledWith("container");
  });

  it("opens a chooser for items with choices and calls onAdd with the chosen key", () => {
    const onAdd = vi.fn();
    render(<AddMenu onAdd={onAdd} onAddImage={vi.fn()} />);
    fireEvent.click(screen.getByTitle("Add to board"));
    fireEvent.click(screen.getByTitle("Person"));
    expect(screen.getByText("Profile card")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Profile card"));
    expect(onAdd).toHaveBeenCalledWith("profile", undefined);
  });

  it("calls onAddImage when the Photo choice is picked", () => {
    const onAdd = vi.fn();
    const onAddImage = vi.fn();
    render(<AddMenu onAdd={onAdd} onAddImage={onAddImage} />);
    fireEvent.click(screen.getByTitle("Add to board"));
    fireEvent.click(screen.getByTitle("Person"));
    fireEvent.click(screen.getByText("Photo"));
    expect(onAddImage).toHaveBeenCalled();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("calls onAdd with 'drawing' for the Draw item", () => {
    const onAdd = vi.fn();
    render(<AddMenu onAdd={onAdd} onAddImage={vi.fn()} />);
    fireEvent.click(screen.getByTitle("Add to board"));
    fireEvent.click(screen.getByTitle("Draw"));
    expect(onAdd).toHaveBeenCalledWith("drawing");
  });
});
