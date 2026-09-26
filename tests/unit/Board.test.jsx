// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// Persistence talks to the API and to IndexedDB, and is covered end to end by
// tests/unit/useBoardPersistence.test.jsx - this file is about what the canvas
// puts on screen, so it stands in with a fixed save state (same approach as
// tests/unit/App.test.jsx stubbing the board out of the shell tests).
vi.mock("../../src/hooks/useBoardPersistence.js", () => ({
  useBoardPersistence: () => ({ save: "saved" }),
}));
vi.mock("../../src/lib/api.js", () => ({
  updateBoard: vi.fn(), uploadImage: vi.fn(),
}));
// Several node types route through useInlineEdit, which drives a zoom animation
// (same mock as tests/unit/nodes.test.jsx).
vi.mock("../../src/lib/useEditZoom.js", () => ({
  useEditZoom: () => ({ focus: vi.fn(), restore: vi.fn() }),
}));

import Board from "../../src/views/Board.jsx";

// React Flow measures the DOM on mount. jsdom has none of that, so give it the
// pieces it asks for - this is React Flow's own documented testing shim.
beforeAll(() => {
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  global.DOMMatrixReadOnly = class { constructor() { this.m22 = 1; } };
  Object.defineProperties(global.HTMLElement.prototype, {
    offsetHeight: { get() { return parseFloat(this.style.height) || 400; }, configurable: true },
    offsetWidth: { get() { return parseFloat(this.style.width) || 600; }, configurable: true },
  });
  global.SVGElement.prototype.getBBox = () => ({ x: 0, y: 0, width: 0, height: 0 });
});

afterEach(cleanup);

const THEME = {
  canvas: "#e0cfa6", dot: "#cbb684", accent: "#d92b1f", text: "#1a1d21",
  muted: "#5f646c", panelBorder: "#e6e1d5", minimapBg: "#fff", minimapNode: "#8a6a3f",
};

const SRC = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

const BOARD = {
  id: "b1",
  title: "Case Alpha",
  nodes: [
    { id: "n1", type: "note", position: { x: 0, y: 0 }, style: { width: 200, height: 140 }, data: { text: "Suspect seen at 9pm" } },
    { id: "n2", type: "image", position: { x: 300, y: 0 }, style: { width: 120, height: 80 }, data: { src: SRC, label: "Exhibit A" } },
  ],
  edges: [{ id: "e1", source: "n1", target: "n2" }],
};

const setup = (over = {}) => render(
  <Board
    board={BOARD} canEdit theme={THEME} themeName="light" readOnly={null}
    onToggleTheme={vi.fn()} onBack={vi.fn()} showToast={vi.fn()} {...over}
  />,
);

describe("Board", () => {
  it("renders both pinned nodes, each through its registered type", () => {
    const { container } = setup();
    expect(screen.getByText("Suspect seen at 9pm")).toBeInTheDocument();
    expect(screen.getByAltText("Exhibit A")).toBeInTheDocument();
    expect(container.querySelectorAll(".react-flow__node")).toHaveLength(2);
    // The thread itself is not asserted here: FloatingEdge routes off the
    // MEASURED size of both ends, which jsdom never reports. tests/e2e covers it.
  });

  it("shows the board title and the save state in the top bar", () => {
    setup();
    expect(screen.getByLabelText("Board title")).toHaveValue("Case Alpha");
    expect(screen.getByText("· Saved")).toBeInTheDocument();
  });

  it("hands the title back up as it is edited", () => {
    setup();
    const input = screen.getByLabelText("Board title");
    fireEvent.change(input, { target: { value: "Case Beta" } });
    expect(input).toHaveValue("Case Beta");
  });

  it("offers the add tools and the back-to-boards button to an owner", () => {
    const onBack = vi.fn();
    setup({ onBack });
    expect(screen.getByLabelText("Open add tools")).toBeInTheDocument();
    fireEvent.click(screen.getByTitle("Back to boards"));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("an empty board tells the owner what to do with it", () => {
    setup({ board: { ...BOARD, nodes: [], edges: [] } });
    expect(screen.getByText("DROP EVIDENCE ONTO THE BOARD")).toBeInTheDocument();
  });

  it("a read-only viewer of an empty board gets a caption too, not a bare corkboard", () => {
    setup({ board: { ...BOARD, nodes: [], edges: [] }, canEdit: false, readOnly: "auth" });
    expect(screen.getByText("NOTHING PINNED HERE YET")).toBeInTheDocument();
    expect(screen.queryByText("DROP EVIDENCE ONTO THE BOARD")).not.toBeInTheDocument();
    // ...and none of the editing chrome.
    expect(screen.queryByLabelText("Open add tools")).not.toBeInTheDocument();
  });
});
