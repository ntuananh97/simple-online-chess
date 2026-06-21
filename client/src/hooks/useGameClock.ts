import { useCallback, useEffect, useRef, useState } from "react";
import type { TimeSnapshot } from "@/types/socket.types";

type ClockColor = "w" | "b";

interface ClockBaseline extends TimeSnapshot {
  syncedAt: number;
}

interface UseGameClockProps {
  isRunning: boolean;
  activeColor: ClockColor;
}

export interface UseGameClockReturn {
  whiteTime: number;
  blackTime: number;
  activeColor: ClockColor;
  syncTime: (snapshot: TimeSnapshot) => void;
}

const TICK_INTERVAL_MS = 100;
const INITIAL_CLOCK: ClockBaseline = {
  whiteTimeLeft: 0,
  blackTimeLeft: 0,
  syncedAt: 0,
};

export function getTurnFromFen(fen: string): ClockColor {
  return fen.split(" ")[1] === "b" ? "b" : "w";
}

function getDisplayTime(
  baseline: ClockBaseline,
  activeColor: ClockColor,
  isRunning: boolean,
): TimeSnapshot {
  if (!isRunning || baseline.syncedAt === 0) {
    return {
      whiteTimeLeft: baseline.whiteTimeLeft,
      blackTimeLeft: baseline.blackTimeLeft,
    };
  }

  const elapsed = Math.max(0, Date.now() - baseline.syncedAt);

  return {
    whiteTimeLeft:
      activeColor === "w"
        ? Math.max(0, baseline.whiteTimeLeft - elapsed)
        : baseline.whiteTimeLeft,
    blackTimeLeft:
      activeColor === "b"
        ? Math.max(0, baseline.blackTimeLeft - elapsed)
        : baseline.blackTimeLeft,
  };
}

export function useGameClock({
  isRunning,
  activeColor,
}: UseGameClockProps): UseGameClockReturn {
  const baselineRef = useRef<ClockBaseline>(INITIAL_CLOCK);
  const activeColorRef = useRef(activeColor);
  const isRunningRef = useRef(isRunning);
  const [displayTime, setDisplayTime] = useState<TimeSnapshot>({
    whiteTimeLeft: INITIAL_CLOCK.whiteTimeLeft,
    blackTimeLeft: INITIAL_CLOCK.blackTimeLeft,
  });
  console.log("🚀 ~ useGameClock ~ displayTime:", displayTime)

  useEffect(() => {
    activeColorRef.current = activeColor;
    isRunningRef.current = isRunning;
  }, [activeColor, isRunning]);

  const syncTime = useCallback((snapshot: TimeSnapshot) => {
    const nextBaseline: ClockBaseline = {
      ...snapshot,
      syncedAt: Date.now(),
    };

    baselineRef.current = nextBaseline;
    const nextDisplayTime = getDisplayTime(
        nextBaseline,
        activeColorRef.current,
        isRunningRef.current,
      );
    console.log("🚀 ~ useGameClock ~ sync >>>>>>:", nextDisplayTime)
    setDisplayTime(
      nextDisplayTime
    );
  }, []);

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    const updateDisplayTime = () => {
         const nextDisplayTime = getDisplayTime(
        baselineRef.current, activeColor, isRunning
      );
    console.log("🚀 ~ useGameClock ~ effect >>>>>>:", nextDisplayTime)
      setDisplayTime(
        getDisplayTime(baselineRef.current, activeColor, isRunning),
      );
    };

    updateDisplayTime();

    const intervalId = window.setInterval(
      updateDisplayTime,
      TICK_INTERVAL_MS,
    );

    return () => {
      window.clearInterval(intervalId);
    };
  }, [activeColor, isRunning]);

  return {
    whiteTime: displayTime.whiteTimeLeft,
    blackTime: displayTime.blackTimeLeft,
    activeColor,
    syncTime,
  };
}
