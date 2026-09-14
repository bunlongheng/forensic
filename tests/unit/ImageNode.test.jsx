// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ReactFlowProvider } from "@xyflow/react";
import ImageNode from "../../src/components/ImageNode.jsx";

afterEach(cleanup);

// useEditZoom drives the fitView animation; assert it is asked to zoom without
// standing up a whole canvas.
const focus = vi.fn();
vi.mock("../../src/lib/useEditZoom.js", () => ({
  useEditZoom: () => ({ focus: (...a) => focus(...a), restore: vi.fn() }),
}));

const SRC = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

function mount(data) {
  return render(
    <ReactFlowProvider>
      <ImageNode id="img" data={{ src: SRC, editable: true, ...data }} selected={false} />
    </ReactFlowProvider>,
  );
}

describe("ImageNode caption", () => {
  it("opens the field and zooms in the moment Caption is switched on for an uncaptioned photo", () => {
    focus.mockClear();
    const { rerender } = mount({ showCaption: false });
    expect(screen.queryByPlaceholderText("Caption")).not.toBeInTheDocument();

    rerender(
      <ReactFlowProvider>
        <ImageNode id="img" data={{ src: SRC, editable: true, showCaption: true }} selected={false} />
      </ReactFlowProvider>,
    );

    // Ready to type, no double-click and no hunting for the photo on the board.
    expect(screen.getByPlaceholderText("Caption")).toHaveFocus();
    expect(focus).toHaveBeenCalledTimes(1);
  });

  it("does NOT hijack the field when re-showing a caption that is already written", () => {
    focus.mockClear();
    const { rerender } = mount({ showCaption: false, label: "already captioned" });
    rerender(
      <ReactFlowProvider>
        <ImageNode id="img" data={{ src: SRC, editable: true, showCaption: true, label: "already captioned" }} selected={false} />
      </ReactFlowProvider>,
    );
    expect(screen.queryByPlaceholderText("Caption")).not.toBeInTheDocument();
    expect(screen.getByText("already captioned")).toBeInTheDocument();
    expect(focus).not.toHaveBeenCalled();
  });

  it("stays put on first render, so opening a board never pops a caption field", () => {
    focus.mockClear();
    mount({ showCaption: true });
    expect(screen.queryByPlaceholderText("Caption")).not.toBeInTheDocument();
    expect(focus).not.toHaveBeenCalled();
  });

  it("leaves a read-only viewer alone", () => {
    focus.mockClear();
    const { rerender } = mount({ showCaption: false, editable: false });
    rerender(
      <ReactFlowProvider>
        <ImageNode id="img" data={{ src: SRC, editable: false, showCaption: true }} selected={false} />
      </ReactFlowProvider>,
    );
    expect(screen.queryByPlaceholderText("Caption")).not.toBeInTheDocument();
    expect(focus).not.toHaveBeenCalled();
  });
});
