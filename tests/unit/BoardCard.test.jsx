// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import BoardCard from "../../src/components/BoardCard.jsx";

afterEach(cleanup);

const board = {
  id: "b1",
  title: "Case 001",
  nodes: [
    { id: "n1", position: { x: 0, y: 0 }, type: "note", data: {} },
    { id: "n2", position: { x: 200, y: 0 }, type: "note", data: {} },
  ],
  edges: [{ source: "n1", target: "n2" }],
  updatedAt: new Date().toISOString(),
}

function setup(overrides = {}) {
  const onOpen = vi.fn()
  const onDelete = vi.fn()
  render(<BoardCard board={{ ...board, ...overrides }} accent="#ff4438" onOpen={onOpen} onDelete={onDelete} />)
  return { onOpen, onDelete }
}

describe("BoardCard", () => {
  it("renders the title and node/link counts", () => {
    setup()
    expect(screen.getByText("Case 001")).toBeInTheDocument()
    expect(screen.getByText(/2 nodes/)).toBeInTheDocument()
    expect(screen.getByText(/1 link/)).toBeInTheDocument()
  })

  it("shows the empty placeholder when there are no nodes", () => {
    setup({ nodes: [], edges: [] })
    expect(screen.getByText("🧵")).toBeInTheDocument()
  })

  it("renders the card body as an accessible button with the board title as its label", () => {
    setup()
    expect(screen.getByRole("button", { name: "Case 001" })).toBeInTheDocument()
  })

  it("calls onOpen when the card is clicked", async () => {
    const { onOpen } = setup()
    await userEvent.click(screen.getByText("Case 001"))
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: "b1" }))
  })

  it("calls onOpen when the card button is activated via keyboard (Enter)", async () => {
    const { onOpen } = setup()
    const user = userEvent.setup()
    await user.tab()
    expect(screen.getByRole("button", { name: "Case 001" })).toHaveFocus()
    await user.keyboard("{Enter}")
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: "b1" }))
  })

  it("calls onDelete and does not also trigger onOpen when the delete button is clicked", async () => {
    const { onOpen, onDelete } = setup()
    await userEvent.click(screen.getByTitle("Delete board"))
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: "b1" }))
    expect(onOpen).not.toHaveBeenCalled()
  })

  describe("node type previews", () => {
    it("renders an <image> element for an image node with data.src", () => {
      const { container } = render(
        <BoardCard
          board={{ ...board, nodes: [{ id: "img1", position: { x: 0, y: 0 }, style: { width: 200, height: 140 }, type: "image", data: { src: "data:image/png;base64,abc" } }], edges: [] }}
          accent="#ff4438" onOpen={vi.fn()} onDelete={vi.fn()}
        />
      )
      const img = container.querySelector("image")
      expect(img).toBeTruthy()
      expect(img.getAttribute("href")).toBe("data:image/png;base64,abc")
    })

    it("renders a placeholder (rect + camera glyph) for an image node without data.src", () => {
      const { container } = render(
        <BoardCard
          board={{ ...board, nodes: [{ id: "img2", position: { x: 0, y: 0 }, style: { width: 200, height: 140 }, type: "image", data: { hasImage: true } }], edges: [] }}
          accent="#ff4438" onOpen={vi.fn()} onDelete={vi.fn()}
        />
      )
      expect(container.querySelector("image")).toBeNull()
      const svg = container.querySelector("svg")
      expect(svg.querySelectorAll("rect").length).toBeGreaterThanOrEqual(2)
      expect(svg.querySelector("circle")).toBeTruthy()
    })

    it("renders a circle + initials text for a profile node", () => {
      const { container } = render(
        <BoardCard
          board={{ ...board, nodes: [{ id: "p1", position: { x: 0, y: 0 }, style: { width: 100, height: 100 }, type: "profile", data: { name: "Jane Doe" } }], edges: [] }}
          accent="#ff4438" onOpen={vi.fn()} onDelete={vi.fn()}
        />
      )
      const circle = container.querySelector("circle")
      expect(circle).toBeTruthy()
      expect(screen.getByText("JD")).toBeInTheDocument()
    })

    it("renders a path per stroke for a drawing node", () => {
      const { container } = render(
        <BoardCard
          board={{
            ...board,
            nodes: [{
              id: "d1", position: { x: 0, y: 0 }, style: { width: 200, height: 140 }, type: "drawing",
              data: { paths: [[[0, 0], [10, 10]], [[20, 20], [30, 30]]] },
            }],
            edges: [],
          }}
          accent="#ff4438" onOpen={vi.fn()} onDelete={vi.fn()}
        />
      )
      const previewSvg = container.querySelector("svg")
      expect(previewSvg.querySelectorAll("path").length).toBe(2)
    })

    it("renders a dashed rect for a container node", () => {
      const { container } = render(
        <BoardCard
          board={{ ...board, nodes: [{ id: "c1", position: { x: 0, y: 0 }, style: { width: 200, height: 140 }, type: "container", data: { color: "#6b7280" } }], edges: [] }}
          accent="#ff4438" onOpen={vi.fn()} onDelete={vi.fn()}
        />
      )
      const rect = container.querySelector("rect[stroke-dasharray]")
      expect(rect).toBeTruthy()
      expect(rect.getAttribute("stroke-dasharray")).toBe("9 6")
    })
  })
})
