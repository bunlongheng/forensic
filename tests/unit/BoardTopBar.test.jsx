// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ReactFlowProvider } from "@xyflow/react";
import { BoardTopBar, MultiSelectBar } from "../../src/components/BoardTopBar.jsx";

afterEach(cleanup);

// The zoom badge reads the live viewport off the React Flow store (so a pan/zoom
// re-renders that span alone, not the whole board), so the bar needs a provider.
const TopBar = (props) => (
  <ReactFlowProvider>
    <BoardTopBar {...props} />
  </ReactFlowProvider>
);

const base = {
  canEdit: true, title: "Case 1", onTitle: vi.fn(), save: "idle", onBack: vi.fn(),
  undo: vi.fn(), redo: vi.fn(), canUndo: true, canRedo: false, onFit: vi.fn(), onExport: vi.fn(),
  onShare: vi.fn(), onReport: vi.fn(), onAddImage: vi.fn(), onAddSticker: vi.fn(), onToggleTheme: vi.fn(), themeName: "light",
};

describe("BoardTopBar", () => {
  // A signed-out deep link used to look exactly like an editable board, so every
  // edit died in silence. The bar has to say which kind of read-only this is.
  it("a signed-out viewer gets a READ-ONLY pill and a way back in", () => {
    render(<TopBar {...base} canEdit={false} readOnly="auth" />);
    expect(screen.getByText("READ-ONLY")).toBeInTheDocument();
    expect(screen.getByText("SIGN IN TO EDIT")).toHaveAttribute("href", "/api/auth/login");
  });

  it("a read-only device says desktop only, with no sign-in link", () => {
    render(<TopBar {...base} canEdit={false} readOnly="device" />);
    expect(screen.getByText("READ-ONLY")).toBeInTheDocument();
    expect(screen.getByText("desktop only")).toBeInTheDocument();
    expect(screen.queryByText("SIGN IN TO EDIT")).toBeNull();
  });

  it("an editable board shows no read-only pill", () => {
    render(<TopBar {...base} />);
    expect(screen.queryByText("READ-ONLY")).toBeNull();
  });

  it("shows the editable title, zoom and full tool cluster for the owner", () => {
    render(<TopBar {...base} />);
    const input = screen.getByLabelText("Board title");
    fireEvent.change(input, { target: { value: "Case 2" } });
    expect(base.onTitle).toHaveBeenCalledWith("Case 2");
    expect(screen.getByText("100%")).toBeInTheDocument();
    fireEvent.click(screen.getByTitle("Undo (Cmd/Ctrl+Z)"));
    expect(base.undo).toHaveBeenCalled();
    expect(screen.getByTitle("Redo (Cmd/Ctrl+Shift+Z)")).toBeDisabled();
    fireEvent.click(screen.getByTitle("Copy share link"));
    expect(base.onShare).toHaveBeenCalled();
    expect(screen.getByTitle("Toggle theme")).toBeInTheDocument();
  });

  it("renders the save pill states", () => {
    const { rerender } = render(<TopBar {...base} save="saving" />);
    expect(screen.getByText(/Saving/)).toBeInTheDocument();
    rerender(<TopBar {...base} save="error" />);
    expect(screen.getByText(/Offline/)).toBeInTheDocument();
    rerender(<TopBar {...base} save="toolarge" />);
    expect(screen.getByText(/Too large to sync/)).toBeInTheDocument();
    rerender(<TopBar {...base} save="unauth" />);
    expect(screen.getByText(/Signed out/)).toBeInTheDocument();
  });

  it("is read-only for viewers: static title, no editing tools, no share without an id", () => {
    render(<TopBar {...base} canEdit={false} onShare={null} />);
    expect(screen.queryByLabelText("Board title")).not.toBeInTheDocument();
    expect(screen.getByText("Case 1")).toBeInTheDocument();
    expect(screen.queryByTitle("Undo (Cmd/Ctrl+Z)")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Copy share link")).not.toBeInTheDocument();
    expect(screen.getByTitle("Case report")).toBeInTheDocument(); // viewers can read the report too
    expect(screen.getByTitle("Fit to view")).toBeInTheDocument();
    expect(screen.getByTitle("Toggle theme")).toBeInTheDocument();
  });
});

describe("MultiSelectBar", () => {
  it("shows the count and fires chain / fan / group", () => {
    const onChain = vi.fn(), onFan = vi.fn(), onGroup = vi.fn();
    render(<MultiSelectBar count={3} onChain={onChain} onFan={onFan} onGroup={onGroup} />);
    expect(screen.getByText("3 selected")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Chain"));
    fireEvent.click(screen.getByText("Fan"));
    fireEvent.click(screen.getByText("Group"));
    expect(onChain).toHaveBeenCalled();
    expect(onFan).toHaveBeenCalled();
    expect(onGroup).toHaveBeenCalled();
  });
});
