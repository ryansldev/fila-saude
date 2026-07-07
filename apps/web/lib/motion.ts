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
