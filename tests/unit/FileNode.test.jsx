// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ReactFlowProvider } from "@xyflow/react";
import FileNode from "../../src/components/FileNode.jsx";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const mount = (data) => render(
  <ReactFlowProvider><FileNode data={{ editable: true, ...data }} /></ReactFlowProvider>,
);

describe("FileNode", () => {
  it("shows a pasted link as a LINK exhibit with its host", () => {
    mount({ kind: "link", url: "https://example.com/case", name: "example.com/case" });
    expect(screen.getByText("Link")).toBeInTheDocument();
    expect(screen.getByText("example.com/case")).toBeInTheDocument();
    expect(screen.getByText("example.com")).toBeInTheDocument();
  });

  it("shows a pasted PDF with its weight", () => {
    mount({ kind: "pdf", name: "warrant.pdf", size: 204800, src: "data:application/pdf;base64,JVBERg==" });
    expect(screen.getByText("PDF")).toBeInTheDocument();
    expect(screen.getByText("200 KB")).toBeInTheDocument();
  });

  it("clicking the icon opens the link in a new tab", () => {
    const open = vi.fn();
    vi.stubGlobal("open", open);
    mount({ kind: "link", url: "https://example.com/", name: "example.com" });
    fireEvent.click(screen.getByLabelText("Open example.com in a new tab"));
    expect(open).toHaveBeenCalledWith("https://example.com/", "_blank", "noopener,noreferrer");
  });

  it("an embedded audio file opens as a blob, never as a data: tab", () => {
    const open = vi.fn();
    vi.stubGlobal("open", open);
    vi.stubGlobal("URL", { ...URL, createObjectURL: () => "blob:clip", revokeObjectURL: vi.fn() });
    mount({ kind: "audio", name: "call.mp3", size: 1024, src: `data:audio/mpeg;base64,${btoa("id3")}` });
    fireEvent.click(screen.getByLabelText("Open call.mp3 in a new tab"));
    expect(open).toHaveBeenCalledWith("blob:clip", "_blank", "noopener,noreferrer");
  });

  it("a renamed exhibit shows its own label", () => {
    mount({ kind: "doc", name: "final_v3_REAL.docx", label: "Signed statement", size: 2048 });
    expect(screen.getByText("Signed statement")).toBeInTheDocument();
    expect(screen.getByText("Document")).toBeInTheDocument();
  });
});
