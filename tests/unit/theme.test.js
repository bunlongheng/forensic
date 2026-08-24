// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTheme, THEMES } from "../../src/theme.js";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});
afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

describe("THEMES", () => {
  it("has a dark and a light palette", () => {
    expect(THEMES.dark).toBeTruthy();
    expect(THEMES.light).toBeTruthy();
    expect(THEMES.dark.accent).toBeTruthy();
    expect(THEMES.light.accent).toBeTruthy();
  });
});

describe("useTheme", () => {
  it("toggling flips document data-theme between dark and light", () => {
    const { result } = renderHook(() => useTheme());
    const first = result.current.theme;
    expect(document.documentElement.getAttribute("data-theme")).toBe(first);

    act(() => {
      result.current.toggle();
    });

    const second = result.current.theme;
    expect(second).not.toBe(first);
    expect(document.documentElement.getAttribute("data-theme")).toBe(second);
    expect(result.current.t).toBe(THEMES[second]);
  });
});
