import type { Transition } from "motion/react";

export type StandardStoryPhase = "idle" | "static" | "intro" | "select" | "result" | "float";
export type AnimatePhase = StandardStoryPhase | "reset";

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

/** Compositor-friendly transform string (prefer over individual x/y/scale/rotate). */
export function tx(y = 0, scale = 1, rotate = 0) {
  return `translateY(${y}px) scale(${scale}) rotate(${rotate}deg)`;
}

export const motionHidden = { opacity: 0, transform: tx(10, 0.92) };
export const motionHiddenBadge = { opacity: 0, transform: tx(10, 0.92, -8) };
export const motionStable = { opacity: 1, transform: tx(0, 1) };

const resetTransition = { duration: 0.2, ease: easeInOut } as const;

export const badgeVariants = {
  idle: motionHiddenBadge,
  static: motionStable,
  reset: { ...motionHiddenBadge, transition: resetTransition },
  intro: {
    opacity: [0, 1, 1],
    transform: [tx(-18, 0.65, -10), tx(0, 1.12), tx(0, 1)],
    transition: { duration: 0.52, ease: easePop },
  },
  select: motionStable,
  result: motionStable,
  float: motionStable,
};

export const introSequence = {
  idle: {},
  static: {},
  reset: {},
  intro: { transition: { staggerChildren: 0.07, delayChildren: 0.06 } },
  select: {},
  result: {},
  float: {},
};

export const popItem = {
  idle: motionHidden,
  static: motionStable,
  reset: { ...motionHidden, transition: resetTransition },
  intro: {
    opacity: [0, 1, 1],
    transform: [tx(12, 0.82), tx(-3, 1.06), tx(0, 1)],
    transition: { duration: 0.44, ease: easePop },
  },
  select: motionStable,
  result: motionStable,
  float: motionStable,
};

export const listSequence = {
  idle: {},
  static: {},
  reset: {},
  intro: { transition: { staggerChildren: 0.05, delayChildren: 0.02 } },
  select: {},
  result: {},
  float: {},
};

export const footerVariants = {
  idle: { opacity: 0, transform: tx(24, 1) },
  static: { opacity: 1, transform: tx(0, 1) },
  reset: { opacity: 0, transform: tx(24, 1), transition: resetTransition },
  intro: { opacity: 0, transform: tx(24, 1) },
  select: { opacity: 0, transform: tx(24, 1) },
  result: {
    opacity: [0, 1, 1],
    transform: [tx(24, 1), tx(0, 1)],
    transition: { duration: 0.55, ease: easePop },
  },
  float: { opacity: 1, transform: tx(0, 1) },
};

export const ctaVariants = {
  idle: { opacity: 0, transform: tx(14, 0.86) },
  static: { opacity: 1, transform: tx(0, 1) },
  reset: { opacity: 0, transform: tx(14, 0.86), transition: resetTransition },
  intro: { opacity: 0, transform: tx(14, 0.86) },
  select: { opacity: 0, transform: tx(14, 0.86) },
  result: {
    opacity: [0, 1, 1],
    transform: [tx(14, 0.86), tx(0, 1.06), tx(0, 1)],
    transition: { duration: 0.5, ease: easePop },
  },
  float: { opacity: 1, transform: tx(0, 1) },
};

export const pressScaleVariant = {
  intro: { transform: "scale(1)" },
  static: { transform: "scale(1)" },
  select: {
    transform: ["scale(1)", "scale(0.94)", "scale(1)"],
    transition: { duration: 0.38, ease: easePop },
  },
  result: { transform: "scale(1)" },
};

export const countPressVariant = {
  intro: { transform: "scale(1)" },
  static: { transform: "scale(1)" },
  select: {
    transform: ["scale(1)", "scale(0.92)", "scale(1)"],
    transition: { duration: 0.38, ease: easePop },
  },
  result: { transform: "scale(1)" },
};

export const emphasisScaleVariant = {
  intro: { transform: "scale(1)" },
  static: { transform: "scale(1)" },
  select: {
    transform: ["scale(1)", "scale(1.06)", "scale(1)"],
    transition: { duration: 0.42, ease: easePop },
  },
  result: { transform: "scale(1)" },
};

export const bellRingVariant = {
  intro: { transform: "rotate(0deg)" },
  static: { transform: "rotate(0deg)" },
  select: {
    transform: ["rotate(0deg)", "rotate(-14deg)", "rotate(14deg)", "rotate(-10deg)", "rotate(10deg)", "rotate(0deg)"],
    transition: { duration: 0.5, ease: easePop },
  },
  result: { transform: "rotate(0deg)" },
};

export const checkPopVariant = {
  idle: { opacity: 0, transform: "scale(0)" },
  static: { opacity: 1, transform: "scale(1)" },
  reset: { opacity: 0, transform: "scale(0)", transition: { duration: 0.15 } },
  intro: { opacity: 0, transform: "scale(0)" },
  select: {
    opacity: 1,
    transform: ["scale(0)", "scale(1.3)", "scale(1)"],
    transition: { duration: 0.42, ease: easePop },
  },
  result: { opacity: 1, transform: "scale(1)" },
  float: { opacity: 1, transform: "scale(1)" },
};

export const illustrationLevitate = {
  transform: [tx(0, 1), tx(-6, 1), tx(0, 1)],
  transition: {
    duration: 2.8,
    repeat: Infinity,
    ease: easeInOut,
  },
};

export const illustrationRest = {
  transform: tx(0, 1),
};

export const lottiePassThrough = {
  rest: {},
  reset: {},
  intro: {},
  select: {},
  result: {},
};

export function lottieSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      return;
    }

    const id = window.setTimeout(resolve, ms);

    const onAbort = () => {
      window.clearTimeout(id);
      reject(signal?.reason ?? new DOMException("Aborted", "AbortError"));
    };

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
