// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("../../src/lib/ocr.js", () => ({
  ocrImage: vi.fn().mockResolvedValue(""),
}));

import { ReportModal } from "../../src/components/ReportModal.jsx";

afterEach(cleanup);

const nodes = [
  { id: "n1", type: "note", data: { text: "First lead" } },
  { id: "n2", type: "note", data: { text: "Second lead" } },
  { id: "n3", type: "image", data: { label: "Suspect photo" } },
];
const edges = [{ source: "n1", target: "n3" }];

describe("ReportModal", () => {
  it("renders the case title", () => {
    render(<ReportModal title="Case Alpha" nodes={nodes} edges={edges} onClose={vi.fn()} />);
    expect(screen.getByText("Case Alpha")).toBeInTheDocument();
  });

  it("lists notes and shows the connection count", () => {
    render(<ReportModal title="Case Alpha" nodes={nodes} edges={edges} onClose={vi.fn()} />);
    expect(screen.getByText("First lead")).toBeInTheDocument();
    expect(screen.getByText("Second lead")).toBeInTheDocument();
    expect(screen.getByText(/Photo:/)).toBeInTheDocument();
  });

  it("shows the notes/photos stat counts", () => {
    render(<ReportModal title="Case Alpha" nodes={nodes} edges={edges} onClose={vi.fn()} />);
    expect(screen.getByText("Notes")).toBeInTheDocument();
    expect(screen.getByText("Photos")).toBeInTheDocument();
    expect(screen.getByText("Links")).toBeInTheDocument();
  });

  it("calls onClose when the Close button is clicked", () => {
    const onClose = vi.fn();
    render(<ReportModal title="Case Alpha" nodes={nodes} edges={edges} onClose={onClose} />);
    fireEvent.click(screen.getByText("Close"));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls window.print when Print / PDF is clicked", () => {
    const printSpy = vi.fn();
    window.print = printSpy;
    render(<ReportModal title="Case Alpha" nodes={nodes} edges={edges} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("Print / PDF"));
    expect(printSpy).toHaveBeenCalled();
  });

  it("renders the panel with dialog semantics", () => {
    render(<ReportModal title="Case Alpha" nodes={nodes} edges={edges} onClose={vi.fn()} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", screen.getByText("Case Alpha").id);
  });

  it("focuses the Close button on mount", () => {
    render(<ReportModal title="Case Alpha" nodes={nodes} edges={edges} onClose={vi.fn()} />);
    expect(screen.getByText("Close")).toHaveFocus();
  });

  it("calls onClose when Escape is pressed", () => {
    const onClose = vi.fn();
    render(<ReportModal title="Case Alpha" nodes={nodes} edges={edges} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("renders Exhibits and People sections for file and profile nodes", () => {
    const withExtras = [
      ...nodes,
      { id: "f1", type: "file", data: { url: "https://example.com/report", name: "example.com/report" } },
      { id: "p1", type: "profile", data: { name: "Jane Doe" } },
    ];
    render(<ReportModal title="Case Alpha" nodes={withExtras} edges={edges} onClose={vi.fn()} />);
    expect(screen.getByText("Exhibits")).toBeInTheDocument();
    expect(screen.getByText("example.com/report")).toBeInTheDocument();
    expect(screen.getByText("People")).toBeInTheDocument();
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
  });

  it("never renders a javascript: link, but does render a real https link", () => {
    const hostileNodes = [
      { id: "n1", type: "note", data: { text: "click here: javascript:alert(1)" } },
      { id: "f1", type: "file", data: { url: "javascript:alert(1)", name: "evil" } },
      { id: "f2", type: "file", data: { url: "https://example.com/safe", name: "safe" } },
    ];
    const { container } = render(<ReportModal title="Case Alpha" nodes={hostileNodes} edges={[]} onClose={vi.fn()} />);
    const hrefs = [...container.querySelectorAll("a[href]")].map((a) => a.getAttribute("href"));
    expect(hrefs.some((h) => h.startsWith("javascript:"))).toBe(false);
    expect(hrefs).toContain("https://example.com/safe");
  });
});
