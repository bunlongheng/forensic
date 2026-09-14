// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { CursorTools } from "../../src/components/CursorTools.jsx";
import { TOOL_ITEMS } from "../../src/lib/tools.js";
import { STAMP_LABELS } from "../../src/lib/constants.js";

const at = { x: 400, y: 300 };
const setup = (props = {}) =>
  render(<CursorTools at={at} items={TOOL_ITEMS} onPick={vi.fn()} onClose={vi.fn()} {...props} />);

afterEach(cleanup);

describe("CursorTools", () => {
  it("renders nothing until it is summoned", () => {
    const { container } = render(<CursorTools at={null} items={TOOL_ITEMS} onPick={vi.fn()} onClose={vi.fn()} />);
    expect(container.querySelectorAll("button")).toHaveLength(0);
  });

  it("blooms one button per tool at the summon point", () => {
    const { container } = setup();
    expect(container.querySelectorAll("button")).toHaveLength(TOOL_ITEMS.length);
    expect(screen.getByTitle("Sticky")).toBeTruthy();
  });

  it("picking a plain tool reports it and does not open a chooser", () => {
    const onPick = vi.fn();
    const { container } = setup({ onPick });
    fireEvent.click(screen.getByTitle("Sticky"));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ key: "note" }));
    expect(container.querySelectorAll("button")).toHaveLength(TOOL_ITEMS.length);
  });

  it("a tool with choices re-blooms the ring as its options instead of picking", () => {
    const onPick = vi.fn();
    const { container } = setup({ onPick });
    fireEvent.click(screen.getByTitle("Stamp"));
    expect(onPick).not.toHaveBeenCalled();
    expect(container.querySelectorAll("button")).toHaveLength(STAMP_LABELS.length);
    expect(screen.getByTitle(STAMP_LABELS[0])).toBeTruthy();
  });

  it("picking a choice reports it with the extra payload that names the stamp", () => {
    const onPick = vi.fn();
    setup({ onPick });
    fireEvent.click(screen.getByTitle("Stamp"));
    fireEvent.click(screen.getByTitle(STAMP_LABELS[1]));
    expect(onPick).toHaveBeenCalledWith(
      expect.objectContaining({ key: "stamp", extra: { label: STAMP_LABELS[1] } }),
    );
  });

  it("the Person chooser offers the photo action, which the board turns into a file pick", () => {
    const onPick = vi.fn();
    setup({ onPick });
    fireEvent.click(screen.getByTitle("Person"));
    fireEvent.click(screen.getByTitle("Photo"));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ action: "image" }));
  });

  it("opens with a clockwise sweep - the stagger follows index order", () => {
    const { container } = setup();
    const btns = [...container.querySelectorAll("button")];
    expect(btns[0].style.animationName).toBe("fx-bloom");
    const delay = (b) => parseFloat(b.style.animationDelay);
    expect(delay(btns[0])).toBe(0);
    expect(delay(btns[1])).toBeGreaterThan(delay(btns[0]));
    expect(delay(btns.at(-1))).toBeGreaterThan(delay(btns[1]));
  });

  it("clicking the backdrop sweeps counter-clockwise first, then closes", async () => {
    const onClose = vi.fn();
    const { container } = setup({ onClose });
    fireEvent.pointerDown(container.querySelector('div[style*="inset"]'));
    expect(onClose).not.toHaveBeenCalled(); // the sweep has to play out first
    const btns = [...container.querySelectorAll("button")];
    expect(btns[0].style.animationName).toBe("fx-retract");
    // Reversed stagger: the LAST button leaves first, so its delay is the shortest.
    const delay = (b) => parseFloat(b.style.animationDelay);
    expect(delay(btns.at(-1))).toBe(0);
    expect(delay(btns[0])).toBeGreaterThan(delay(btns.at(-1)));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("the board can drive the same exit sweep with the closing prop", async () => {
    const onClose = vi.fn();
    const { container } = setup({ closing: true, onClose });
    expect(container.querySelector("button").style.animationName).toBe("fx-retract");
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
