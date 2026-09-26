// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { useInlineEdit } from "../../src/hooks/useInlineEdit.js";

afterEach(cleanup);

// Drives the zoom animation on real boards; not what this hook's own state
// machine is about, so keep it a no-op here (same pattern as ImageNode.test.jsx).
const focus = vi.fn();
const restore = vi.fn();
vi.mock("../../src/lib/useEditZoom.js", () => ({
  useEditZoom: () => ({ focus: (...a) => focus(...a), restore: (...a) => restore(...a) }),
}));

function Harness({ initial = "hello", onCommit = vi.fn(), opts }) {
  const { editing, draft, setDraft, ref, rootRef, startEdit, commit, cancel } =
    useInlineEdit("n1", initial, onCommit, opts);
  return (
    // Stands in for the .react-flow__node wrapper React Flow focuses; rootRef
    // is put one level down, exactly as every *Node.jsx does.
    <div className="react-flow__node" tabIndex={0} data-testid="wrapper">
      <div ref={rootRef}>
        {editing ? (
          <input
            ref={ref} data-testid="field" value={draft}
            onChange={(e) => setDraft(e.target.value)} onBlur={commit}
            onKeyDown={(e) => { if (e.key === "Escape") cancel(); }}
          />
        ) : (
          <button data-testid="start" onClick={() => startEdit()}>start</button>
        )}
        <span data-testid="editing-state">{String(editing)}</span>
      </div>
    </div>
  );
}

describe("useInlineEdit", () => {
  it("starts closed, and startEdit opens it with the initial value as the draft", () => {
    render(<Harness initial="hello" />);
    expect(screen.getByTestId("editing-state")).toHaveTextContent("false");
    fireEvent.click(screen.getByTestId("start"));
    expect(screen.getByTestId("editing-state")).toHaveTextContent("true");
    expect(screen.getByTestId("field")).toHaveValue("hello");
  });

  it("commit hands the draft to onCommit, closes, and restores the view", () => {
    const onCommit = vi.fn();
    restore.mockClear();
    render(<Harness initial="hello" onCommit={onCommit} />);
    fireEvent.click(screen.getByTestId("start"));
    fireEvent.change(screen.getByTestId("field"), { target: { value: "updated" } });
    fireEvent.blur(screen.getByTestId("field"));
    expect(onCommit).toHaveBeenCalledWith("updated");
    expect(screen.getByTestId("editing-state")).toHaveTextContent("false");
    expect(restore).toHaveBeenCalled();
  });

  it("cancel (Escape) leaves edit mode without calling onCommit", () => {
    const onCommit = vi.fn();
    render(<Harness initial="hello" onCommit={onCommit} />);
    fireEvent.click(screen.getByTestId("start"));
    fireEvent.keyDown(screen.getByTestId("field"), { key: "Escape" });
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByTestId("editing-state")).toHaveTextContent("false");
  });

  it("Enter on the focused node wrapper opens edit mode (keyboard, no double-click)", () => {
    render(<Harness initial="hello" />);
    const wrapper = screen.getByTestId("wrapper");
    wrapper.focus();
    fireEvent.keyDown(wrapper, { key: "Enter" });
    expect(screen.getByTestId("editing-state")).toHaveTextContent("true");
  });

  it("does not react to Enter on the wrapper when editable is false", () => {
    render(<Harness initial="hello" opts={{ editable: false }} />);
    const wrapper = screen.getByTestId("wrapper");
    wrapper.focus();
    fireEvent.keyDown(wrapper, { key: "Enter" });
    expect(screen.getByTestId("editing-state")).toHaveTextContent("false");
  });

  it("select: false focuses the field without selecting its text", () => {
    render(<Harness initial="hello" opts={{ select: false }} />);
    fireEvent.click(screen.getByTestId("start"));
    const field = screen.getByTestId("field");
    expect(field).toHaveFocus();
    // jsdom reports the full value as "selected" by default; select:false must
    // not have called .select() explicitly - selectionStart stays at the caret.
    expect(field.selectionStart).toBe(field.selectionEnd);
  });
});
