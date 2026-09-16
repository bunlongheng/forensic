// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ReactFlowProvider } from "@xyflow/react";
import WaxSealNode from "../../src/components/WaxSealNode.jsx";

afterEach(cleanup);

const mount = (id, data = {}) => render(
  <ReactFlowProvider>
    <WaxSealNode id={id} data={{ editable: true, ...data }} selected={false} />
  </ReactFlowProvider>,
);

const blob = (c) => c.container.querySelector("svg path").getAttribute("d");

describe("WaxSealNode", () => {
  it("presses the emboss into the wax, three times over for the bevel", () => {
    const { container } = mount("wax-1", { symbol: "R" });
    const texts = [...container.querySelectorAll("text")].map((t) => t.textContent);
    expect(texts).toEqual(["R", "R", "R"]); // shadow, highlight, face
  });

  it("falls back to a star", () => {
    const { container } = mount("wax-2");
    expect(container.querySelector("text").textContent).toBe("★");
  });

  it("shades the wax colour into a gradient, so a custom colour really takes", () => {
    const { container } = mount("wax-3", { color: "#1f3a5c" });
    const stops = [...container.querySelectorAll("radialGradient stop")].map((s) => s.getAttribute("stop-color"));
    expect(stops).toContain("#1f3a5c"); // the colour itself, mid-gradient
    expect(stops.some((c) => c && c !== "#1f3a5c" && c.startsWith("#"))).toBe(true); // lightened + darkened
  });

  it("gives every seal its own blob, stable for the same node id", () => {
    const a = blob(mount("wax-a"));
    cleanup();
    const b = blob(mount("wax-b"));
    cleanup();
    const aAgain = blob(mount("wax-a"));
    expect(a).not.toBe(b);      // each seal is its own shape
    expect(aAgain).toBe(a);     // and it does not change under the owner
  });

  it("scopes its gradient and filter ids to the node, so two seals cannot collide", () => {
    const { container } = mount("wax-9");
    expect(container.querySelector("radialGradient").id).toBe("wg-wax-9");
    expect(container.querySelector("filter").id).toBe("wf-wax-9");
  });
});
