"use client";

import { useEffect, useState } from "react";

import { lottieSleep, type StandardStoryPhase } from "@/lib/motion";

export interface StandardPhaseDurations {
  intro: number;
  select: number;
  result: number;
}

export function useStandardPhaseLoop(
  isInView: boolean,
  prefersReducedMotion: boolean,
  durations: StandardPhaseDurations,
) {
  const [phase, setPhase] = useState<StandardStoryPhase>("idle");
  const [storyDone, setStoryDone] = useState(false);

  useEffect(() => {
    if (!isInView && !storyDone) {
      setPhase("idle");
    }
  }, [isInView, storyDone]);

  useEffect(() => {
    if (prefersReducedMotion || !isInView || storyDone) return;

    const controller = new AbortController();

    void (async () => {
      try {
        setPhase("intro");
        await lottieSleep(durations.intro, controller.signal);

        setPhase("select");
        await lottieSleep(durations.select, controller.signal);

        setPhase("result");
        await lottieSleep(durations.result, controller.signal);

        setStoryDone(true);
        setPhase("float");
      } catch {
        // loop aborted on unmount or viewport exit
      }
    })();

    return () => controller.abort();
  }, [isInView, prefersReducedMotion, storyDone, durations.intro, durations.select, durations.result]);

  const contentPhase: StandardStoryPhase | "static" = prefersReducedMotion
    ? "static"
    : storyDone || phase === "float" || phase === "result"
      ? "result"
      : phase;

  const levitating = isInView && storyDone && !prefersReducedMotion;

  return { phase, storyDone, contentPhase, levitating };
}
