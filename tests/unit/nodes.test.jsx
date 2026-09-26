// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ReactFlowProvider } from "@xyflow/react";

import ImageNode from "../../src/components/ImageNode.jsx";
import NoteNode from "../../src/components/NoteNode.jsx";
import TextNode from "../../src/components/TextNode.jsx";
import ProfileNode from "../../src/components/ProfileNode.jsx";
import StickerNode from "../../src/components/StickerNode.jsx";
import ContainerNode from "../../src/components/ContainerNode.jsx";
import AnnotationNode from "../../src/components/AnnotationNode.jsx";
import DrawingNode from "../../src/components/DrawingNode.jsx";
import CalloutNode from "../../src/components/CalloutNode.jsx";
import ClipNode from "../../src/components/ClipNode.jsx";
import StampNode from "../../src/components/StampNode.jsx";
import RedactionNode from "../../src/components/RedactionNode.jsx";
import CrosshairNode from "../../src/components/CrosshairNode.jsx";
import WaxSealNode from "../../src/components/WaxSealNode.jsx";
import FileNode from "../../src/components/FileNode.jsx";

afterEach(cleanup);

// Several node types route through useInlineEdit, which drives a zoom animation
// via useEditZoom - not what this smoke test is about (same mock used by
// ImageNode.test.jsx and useInlineEdit.test.jsx).
vi.mock("../../src/lib/useEditZoom.js", () => ({
  useEditZoom: () => ({ focus: vi.fn(), restore: vi.fn() }),
}));

const SRC = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

// One row per key in Board.jsx's NODE_TYPES registry, with data that exercises
// its visible text/label and how to check that content once mounted.
const CASES = [
  {
    type: "image", Component: ImageNode, data: { src: SRC, label: "Exhibit A" },
    check: () => expect(screen.getByAltText("Exhibit A")).toBeInTheDocument(),
  },
  {
    type: "note", Component: NoteNode, data: { text: "Headline" },
    check: () => expect(screen.getByText("Headline")).toBeInTheDocument(),
  },
  {
    type: "text", Component: TextNode, data: { text: "ransom note" },
    check: () => expect(screen.getByText("ransom note")).toBeInTheDocument(),
  },
  {
    type: "profile", Component: ProfileNode, data: { name: "Jane Doe" },
    check: () => {
      expect(screen.getByText("Jane Doe")).toBeInTheDocument()
      expect(screen.getByText("JD")).toBeInTheDocument()
    },
  },
  {
    type: "sticker", Component: StickerNode, data: { emoji: "🔥" },
    check: () => expect(screen.getByText("🔥")).toBeInTheDocument(),
  },
  {
    type: "container", Component: ContainerNode, data: { title: "Section A" },
    check: () => expect(screen.getByText("Section A")).toBeInTheDocument(),
  },
  {
    type: "annotation", Component: AnnotationNode, data: { color: "#e5231b" },
    check: (c) => expect(c.container.querySelector("svg path")).toBeTruthy(),
  },
  {
    type: "drawing", Component: DrawingNode, data: { paths: [] },
    check: (c) => expect(c.container.querySelector("svg")).toBeTruthy(),
  },
  {
    type: "callout", Component: CalloutNode, data: { text: "Watch out!" },
    check: () => expect(screen.getByText("Watch out!")).toBeInTheDocument(),
  },
  {
    type: "clip", Component: ClipNode, data: { text: "quick note" },
    check: () => expect(screen.getByText("quick note")).toBeInTheDocument(),
  },
  {
    type: "stamp", Component: StampNode, data: { label: "APPROVED" },
    check: () => expect(screen.getByText("APPROVED")).toBeInTheDocument(),
  },
  {
    type: "redaction", Component: RedactionNode, data: { color: "#111111" },
    check: (c) => expect(c.container.firstChild).toBeTruthy(),
  },
  {
    type: "crosshair", Component: CrosshairNode, data: { color: "#e5231b" },
    check: (c) => expect(c.container.querySelector("svg")).toBeTruthy(),
  },
  {
    type: "wax", Component: WaxSealNode, data: { symbol: "R" },
    check: () => expect(screen.getAllByText("R").length).toBeGreaterThan(0),
  },
  {
    type: "file", Component: FileNode, data: { kind: "pdf", label: "Report.pdf" },
    check: () => {
      expect(screen.getByText("Report.pdf")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Open Report.pdf in a new tab" })).toBeInTheDocument()
    },
  },
];

describe("every registered node type (Board.jsx NODE_TYPES)", () => {
  it.each(CASES)("$type mounts and shows its content", ({ Component, data, check }) => {
    const c = render(
      <ReactFlowProvider>
        <Component id="n1" data={{ editable: true, ...data }} selected={false} />
      </ReactFlowProvider>,
    );
    check(c);
  });
});
