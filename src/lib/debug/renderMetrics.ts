"use client";

import { useMemo, useRef } from "react";

export interface RenderMetricsSnapshot {
  /** Number of times the parent component rendered. */
  readonly renderCount: number;
  /** Time elapsed between the two most recent renders, in milliseconds. */
  readonly lastRenderIntervalMs: number | null;
  /** Arithmetic mean of render intervals, in milliseconds. */
  readonly averageRenderIntervalMs: number | null;
  /** Wall-clock timestamp (in ms) of the latest render. */
  readonly lastRenderTimestamp: number;
}

const getHighResolutionTimestamp = (): number => {
  if (
    typeof performance !== "undefined" &&
    typeof performance.now === "function"
  ) {
    return performance.now();
  }
  return Date.now();
};

/**
 * Tracks lightweight render metrics without triggering additional re-renders.
 *
 * The hook maintains counters in refs and recomputes a derived snapshot on
 * every render. Consumers can read the snapshot to monitor render frequency
 * when diagnosing UI performance issues.
 */
export const useRenderMetrics = (): RenderMetricsSnapshot => {
  const renderCountRef = useRef(0);
  const previousHighResolutionTimestampRef = useRef<number | null>(null);
  const totalIntervalRef = useRef(0);
  const lastIntervalRef = useRef<number | null>(null);

  const wallClockNow = Date.now();
  const highResolutionNow = getHighResolutionTimestamp();

  const previousHighResolutionTimestamp =
    previousHighResolutionTimestampRef.current;
  if (previousHighResolutionTimestamp !== null) {
    const interval = highResolutionNow - previousHighResolutionTimestamp;
    totalIntervalRef.current += interval;
    lastIntervalRef.current = interval;
  }

  renderCountRef.current += 1;
  previousHighResolutionTimestampRef.current = highResolutionNow;

  return useMemo<RenderMetricsSnapshot>(() => {
    const renderCount = renderCountRef.current;
    const averageInterval =
      renderCount > 1 ? totalIntervalRef.current / (renderCount - 1) : null;

    return {
      renderCount,
      lastRenderIntervalMs: lastIntervalRef.current,
      averageRenderIntervalMs: averageInterval,
      lastRenderTimestamp: wallClockNow,
    } as const;
  }, [wallClockNow]);
};
