"use client";

import { Bell } from "lucide-react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { useRef } from "react";

import { BrandName } from "@/components/landing/brand-name";
import { easeInOut, easePop, illustrationLevitate, inViewViewportLoop } from "@/lib/motion";
import { useStandardPhaseLoop } from "@/lib/use-standard-phase-loop";
import { cn } from "@/lib/utils";

import {
  floatingBadgeClasses,
  IllustrationScene,
  IllustrationStage,
  PhoneFrame,
} from "../illustration-stage";

const hiddenItem = { scale: 0.92, y: 10, opacity: 0 };

const badgeVariants = {
  idle: { ...hiddenItem, rotate: -8 },
  static: { scale: 1, y: 0, rotate: 0, opacity: 1 },
  reset: { ...hiddenItem, rotate: -8, transition: { duration: 0.2, ease: easeInOut } },
  intro: {
    opacity: [0, 1, 1],
    scale: [0.65, 1.12, 1],
    y: [-18, 0],
    rotate: [-10, 0],
    transition: { duration: 0.52, ease: easePop },
  },
  select: { scale: 1, y: 0, rotate: 0, opacity: 1 },
  result: { scale: 1, y: 0, rotate: 0, opacity: 1 },
};

const introSequence = {
  idle: {},
  static: {},
  reset: {},
  intro: { transition: { staggerChildren: 0.08, delayChildren: 0.06 } },
  select: {},
  result: {},
};

const popItem = {
  idle: hiddenItem,
  static: { scale: 1, y: 0, opacity: 1 },
  reset: { ...hiddenItem, transition: { duration: 0.2, ease: easeInOut } },
  intro: {
    opacity: [0, 1, 1],
    scale: [0.82, 1.06, 1],
    y: [12, -3, 0],
    transition: { duration: 0.44, ease: easePop },
  },
  select: { scale: 1, y: 0, opacity: 1 },
  result: { scale: 1, y: 0, opacity: 1 },
};

const bellRing = {
  intro: { rotate: 0 },
  static: { rotate: 0 },
  select: {
    rotate: [0, -14, 14, -10, 10, 0],
    transition: { duration: 0.5, ease: easePop },
  },
  result: { rotate: 0 },
};

const footerVariants = {
  idle: { opacity: 0, y: 24 },
  static: { opacity: 1, y: 0 },
  reset: { opacity: 0, y: 24, transition: { duration: 0.2, ease: easeInOut } },
  intro: { opacity: 0, y: 24 },
  select: { opacity: 0, y: 24 },
  result: {
    opacity: [0, 1, 1],
    y: [24, 0],
    transition: { duration: 0.55, ease: easePop },
  },
};

const PHASE_DURATIONS = {
  intro: 1400,
  select: 520,
  result: 900,
} as const;

export function NotificationIllustration() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, inViewViewportLoop);
  const prefersReducedMotion = useReducedMotion();
  const { contentPhase, levitating } = useStandardPhaseLoop(isInView, !!prefersReducedMotion, PHASE_DURATIONS);

  const bellPhase =
    contentPhase === "idle" || contentPhase === "intro"
      ? "intro"
      : contentPhase === "select"
        ? "select"
        : "result";

  return (
    <IllustrationStage tone="green">
      <IllustrationScene className="pb-20 sm:pb-24">
        <motion.div
          ref={ref}
          className="relative"
          animate={levitating ? illustrationLevitate : { y: 0 }}
        >
          <motion.div
            className={cn(floatingBadgeClasses("right"), "inline-flex")}
            initial="idle"
            animate={contentPhase}
            variants={badgeVariants}
          >
            <Bell className="size-4 text-green-600" strokeWidth={2.5} />
            <span className="text-sm font-bold text-gray-700">na hora</span>
          </motion.div>

          <PhoneFrame>
            <motion.div
              className="flex h-52 items-center justify-center rounded-2xl bg-linear-to-b from-primary-50 to-white px-4 sm:h-56"
              initial="idle"
              animate={contentPhase}
              variants={introSequence}
            >
              <div className="flex flex-col items-center gap-3 text-center">
                <motion.div variants={popItem}>
                  <BrandName size="sm" logoClassName="size-6" textClassName="text-sm font-bold text-gray-500" />
                </motion.div>
                <motion.p
                  className="text-base font-extrabold lowercase text-gray-800 sm:text-lg"
                  variants={popItem}
                >
                  acolhimento · senha 013
                </motion.p>
                <motion.div className="flex items-center justify-center gap-1.5" variants={popItem}>
                  <motion.span
                    className="inline-flex origin-top"
                    initial="intro"
                    animate={bellPhase}
                    variants={bellRing}
                  >
                    <Bell className="size-4 text-primary" strokeWidth={2.5} />
                  </motion.span>
                  <p className="text-sm font-bold text-gray-500">aguardando sua vez...</p>
                </motion.div>
              </div>
            </motion.div>
          </PhoneFrame>

          <motion.div
            className="absolute inset-x-6 -bottom-5 z-20 sm:inset-x-8 sm:-bottom-6"
            initial="idle"
            animate={contentPhase}
            variants={footerVariants}
          >
            <div className="flex items-center justify-center gap-1.5 rounded-xl border border-b-[3px] border-green-700 bg-green-500 px-3 py-2 shadow-md">
              <Bell className="size-3.5 shrink-0 text-white" strokeWidth={3} />
              <p className="text-sm font-extrabold text-white">sua vez no acolhimento!</p>
            </div>
          </motion.div>
        </motion.div>
      </IllustrationScene>
    </IllustrationStage>
  );
}
