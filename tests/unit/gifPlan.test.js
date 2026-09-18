import { describe, it, expect } from "vitest";
import { planFrames, scaledSize, nextPlan, MAX_FRAMES, MIN_FRAMES, MIN_SCALE } from "../../src/lib/gifPlan.js";

describe("planFrames", () => {
  it("keeps every frame when the clip is already under budget", () => {
    const plan = planFrames([100, 100, 100]);
    expect(plan.map((f) => f.index)).toEqual([0, 1, 2]);
    expect(plan.map((f) => f.delay)).toEqual([100, 100, 100]);
  });

  it("thins a 271-frame clip to the budget and keeps its running time", () => {
    const durations = Array(271).fill(30); // the LinkedIn infographic: 271 x 30ms
    const plan = planFrames(durations);
    expect(plan.length).toBeLessThanOrEqual(MAX_FRAMES);
    expect(plan[0]).toEqual({ index: 0, delay: 120 }); // 4 frames folded into 1
    const total = plan.reduce((n, f) => n + f.delay, 0);
    expect(Math.abs(total - 271 * 30)).toBeLessThan(120); // within 1 kept frame
  });

  it("never emits a delay the browser would clamp up to 100ms", () => {
    expect(planFrames([0, 5, 10]).every((f) => f.delay >= 20)).toBe(true);
  });
});

describe("nextPlan - sizing the next pass from what the last one measured", () => {
  it("is null when the last pass already fits", () => {
    expect(nextPlan(1_500_000, 2_000_000, 68, 1)).toBeNull();
  });

  it("splits a 10x overshoot between frames and scale, landing under target", () => {
    // 68 frames at 640x800 came out at 20 MB against a 2 MB target
    const p = nextPlan(20_000_000, 2_000_000, 68, 1);
    expect(p.frames).toBeGreaterThanOrEqual(MIN_FRAMES);
    expect(p.frames).toBeLessThan(68);
    expect(p.scale).toBeLessThan(1);
    // predicted bytes: linear in pixels x frames, with the safety margin applied
    const predicted = 20_000_000 * (p.frames / 68) * p.scale * p.scale;
    expect(predicted).toBeLessThanOrEqual(2_000_000);
    expect(predicted).toBeGreaterThan(1_200_000); // not absurdly small either
  });

  it("never goes below the frame floor - the rest comes off the scale", () => {
    const p = nextPlan(8_000_000, 2_000_000, MIN_FRAMES, 1);
    expect(p.frames).toBe(MIN_FRAMES);
    expect(p.scale).toBeLessThan(1);
  });

  it("gives up honestly when even the floor cannot fit", () => {
    expect(nextPlan(200_000_000, 2_000_000, MIN_FRAMES, MIN_SCALE)).toBeNull();
  });
});

describe("scaledSize", () => {
  it("keeps the aspect ratio and never collapses to zero", () => {
    for (const s of [1, 0.6, MIN_SCALE, 0.01]) {
      const { width, height } = scaledSize(640, 800, s);
      expect(width).toBeGreaterThanOrEqual(16);
      expect(height).toBeGreaterThanOrEqual(16);
      if (s >= MIN_SCALE) expect(width / height).toBeCloseTo(0.8, 1);
    }
  });
});
