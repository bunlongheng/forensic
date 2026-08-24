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

  it("calls onOpen when the card is clicked", async () => {
    const { onOpen } = setup()
    await userEvent.click(screen.getByText("Case 001"))
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: "b1" }))
  })

  it("calls onDelete and does not also trigger onOpen when the delete button is clicked", async () => {
    const { onOpen, onDelete } = setup()
    await userEvent.click(screen.getByTitle("Delete board"))
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: "b1" }))
    expect(onOpen).not.toHaveBeenCalled()
  })
})
