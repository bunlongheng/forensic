// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useBoardShortcuts } from "../../src/hooks/useBoardShortcuts.js";

afterEach(cleanup);

const photo = { id: "a", type: "image", selected: true };
const group = { id: "g", type: "container", selected: true };
const child = { id: "c", type: "note", parentId: "g", selected: true };

function setup(nodes = [photo], canEdit = true) {
  const groupSelected = vi.fn(), ungroupSelected = vi.fn();
  renderHook(() => useBoardShortcuts({ canEdit, nodes, groupSelected, ungroupSelected }));
  return { groupSelected, ungroupSelected };
}

const cmdG = (opts = {}) => window.dispatchEvent(
  new KeyboardEvent("keydown", { key: "g", metaKey: true, cancelable: true, ...opts }),
);

describe("useBoardShortcuts", () => {
  it("Cmd+G groups when the selection is loose nodes", () => {
    const { groupSelected, ungroupSelected } = setup();
    act(() => { cmdG(); });
    expect(groupSelected).toHaveBeenCalledTimes(1);
    expect(ungroupSelected).not.toHaveBeenCalled();
  });

  it("Cmd+G UNGROUPS when a container is selected - the same keys toggle", () => {
    const { groupSelected, ungroupSelected } = setup([group]);
    act(() => { cmdG(); });
    expect(ungroupSelected).toHaveBeenCalledTimes(1);
    expect(groupSelected).not.toHaveBeenCalled();
  });

  it("selecting a CHILD of a group counts as selecting the group", () => {
    const { ungroupSelected } = setup([group, child]);
    act(() => { cmdG(); });
    expect(ungroupSelected).toHaveBeenCalledTimes(1);
  });

  it("Shift+Cmd+G forces ungroup even on a loose selection", () => {
    const { groupSelected, ungroupSelected } = setup();
    act(() => { cmdG({ shiftKey: true }); });
    expect(ungroupSelected).toHaveBeenCalledTimes(1);
    expect(groupSelected).not.toHaveBeenCalled();
  });

  it("ignores the shortcut while typing in a field", () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    const { groupSelected } = setup();
    act(() => { cmdG(); });
    expect(groupSelected).not.toHaveBeenCalled();
    input.remove();
  });

  it("ignores a bare G, and does nothing at all on a read-only board", () => {
    const { groupSelected } = setup();
    act(() => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "g" })); });
    expect(groupSelected).not.toHaveBeenCalled();

    const ro = setup([photo], false);
    act(() => { cmdG(); });
    expect(ro.groupSelected).not.toHaveBeenCalled();
  });
});
