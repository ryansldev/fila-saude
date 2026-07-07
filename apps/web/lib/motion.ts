import type { Transition } from "motion/react";

export const springPop: Transition = {
  type: "spring",
  stiffness: 520,
  damping: 20,
  mass: 0.7,
};

export const springSoft: Transition = {
  type: "spring",
  stiffness: 320,
  damping: 28,
  mass: 0.85,
};

export const inViewViewport = {
  once: true,
  amount: 0.35,
} as const;

export const inViewViewportLoop = {
  once: false,
  amount: 0.35,
} as const;

export const easePop = [0.34, 1.45, 0.64, 1] as const;
export const easeInOut = "easeInOut" as const;

export const illustrationLevitate = {
  y: [0, -6, 0],
  transition: {
    duration: 2.8,
    repeat: Infinity,
    ease: easeInOut,
  },
};

export const lottiePassThrough = {
  rest: {},
  reset: {},
  intro: {},
  select: {},
  result: {},
};

export function lottieSleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
