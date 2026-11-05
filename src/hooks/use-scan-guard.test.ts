import type { KeyboardEvent } from "react";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useScanGuard } from "./use-scan-guard.ts";

type FakeKey = { code: string; key: string; timeStamp: number; value: string };

// Minimal keydown event with just what the guard reads
function keyEvent({ code, key, timeStamp, value }: FakeKey) {
  const preventDefault = vi.fn();
  const target = { value, blur: vi.fn() };
  const event = {
    code,
    key,
    timeStamp,
    shiftKey: false,
    ctrlKey: false,
    getModifierState: () => false,
    currentTarget: target,
    preventDefault,
  };
  return {
    event: event as unknown as KeyboardEvent<HTMLInputElement>,
    preventDefault,
  };
}

function digits(text: string, gapMs: number, value: string) {
  return [...text].map((d, i) =>
    keyEvent({ code: `Digit${d}`, key: d, timeStamp: 1000 + i * gapMs, value }),
  );
}

describe("useScanGuard", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("blocks a scan in the quantity box, including its Enter, and restores the old value", () => {
    const onBlocked = vi.fn();
    const { result } = renderHook(() => useScanGuard(onBlocked));
    const keys = digits("010185742", 5, "12");
    keys.forEach(({ event }) => result.current(event));
    // First keys can't be told apart from typing; later ones are blocked
    expect(keys[0].preventDefault).not.toHaveBeenCalled();
    expect(keys[8].preventDefault).toHaveBeenCalled();

    const enter = keyEvent({
      code: "Enter",
      key: "Enter",
      timeStamp: 1050,
      value: "01018",
    });
    act(() => result.current(enter.event));
    expect(enter.preventDefault).toHaveBeenCalled();
    expect(onBlocked).toHaveBeenCalledWith("12");
  });

  it("lets a person type a quantity and press Enter", () => {
    const onBlocked = vi.fn();
    const { result } = renderHook(() => useScanGuard(onBlocked));
    const keys = digits("150", 200, "1");
    keys.forEach(({ event }) => result.current(event));
    const enter = keyEvent({
      code: "Enter",
      key: "Enter",
      timeStamp: 2000,
      value: "150",
    });
    act(() => result.current(enter.event));
    act(() => vi.runAllTimers());
    expect(keys.some((k) => k.preventDefault.mock.calls.length > 0)).toBe(
      false,
    );
    expect(enter.preventDefault).not.toHaveBeenCalled();
    expect(onBlocked).not.toHaveBeenCalled();
  });

  it("restores after a scan that ends without Enter", () => {
    const onBlocked = vi.fn();
    const { result } = renderHook(() => useScanGuard(onBlocked));
    digits("85742000", 5, "3").forEach(({ event }) => result.current(event));
    act(() => vi.runAllTimers());
    expect(onBlocked).toHaveBeenCalledWith("3");
  });
});
