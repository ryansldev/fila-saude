"use client";

import { ArrowUp, Clock, Users } from "lucide-react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { useRef } from "react";

import { easeInOut, easePop, illustrationLevitate, inViewViewportLoop } from "@/lib/motion";
import { useStandardPhaseLoop } from "@/lib/use-standard-phase-loop";
import { cn } from "@/lib/utils";

import {
  floatingBadgeClasses,
  IllustrationScene,
  IllustrationStage,
  PhoneFrame,
  PhoneQueueHeader,
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
  intro: { transition: { staggerChildren: 0.07, delayChildren: 0.06 } },
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

const listSequence = {
  idle: {},
  static: {},
  reset: {},
  intro: { transition: { staggerChildren: 0.05, delayChildren: 0.02 } },
  select: {},
  result: {},
};

const positionPop = {
  intro: { scale: 1 },
  static: { scale: 1 },
  select: {
    scale: [1, 1.06, 1],
    transition: { duration: 0.42, ease: easePop },
  },
  result: { scale: 1 },
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
  intro: 1600,
  select: 520,
  result: 900,
} as const;

export function QueuePositionIllustration() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, inViewViewportLoop);
  const prefersReducedMotion = useReducedMotion();
  const { contentPhase, levitating } = useStandardPhaseLoop(isInView, !!prefersReducedMotion, PHASE_DURATIONS);

  const isAdvanced =
    contentPhase === "select" || contentPhase === "result" || contentPhase === "static";

  const positionPhase =
    contentPhase === "idle" || contentPhase === "intro"
      ? "intro"
      : contentPhase === "select"
        ? "select"
        : "result";

  return (
    <IllustrationStage tone="yellow">
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
            <span className="size-2.5 animate-pulse rounded-full bg-green-500" />
            <span className="text-sm font-bold text-gray-700">ao vivo</span>
          </motion.div>

          <PhoneFrame>
            <motion.div
              className="space-y-3 px-1 pb-2 pt-1"
              initial="idle"
              animate={contentPhase}
              variants={introSequence}
            >
              <motion.div variants={popItem}>
                <PhoneQueueHeader ticket="013" />
              </motion.div>

              <motion.div
                className="rounded-2xl border border-b-4 border-primary-200 bg-primary-50 px-4 py-5 text-center"
                variants={popItem}
              >
                <p className="text-sm font-bold lowercase tracking-wide text-primary-700">sua posição</p>
                <motion.p
                  className="mt-1 text-6xl font-extrabold leading-none text-primary tabular-nums sm:text-8xl lg:text-9xl"
                  initial="intro"
                  animate={positionPhase}
                  variants={positionPop}
                >
                  {isAdvanced ? "4º" : "5º"}
                </motion.p>
                <p className="mt-2 text-sm font-bold lowercase tracking-wide text-gray-500">no acolhimento</p>
              </motion.div>

              <motion.div className="space-y-2" variants={popItem}>
                <div className="flex items-center justify-between text-sm font-bold text-gray-500">
                  <span className="tabular-nums">{isAdvanced ? "3" : "4"} na frente</span>
                  <span className="tabular-nums">9 atrás</span>
                </div>
                <div className="relative h-3 overflow-hidden rounded-full bg-gray-100">
                  <motion.div
                    className="absolute inset-y-0 left-0 rounded-full bg-primary"
                    animate={{ width: isAdvanced ? "28%" : "22%" }}
                    transition={{ duration: 0.45, ease: easePop }}
                  />
                  <motion.div
                    className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary shadow-sm"
                    animate={{ left: isAdvanced ? "28%" : "22%" }}
                    transition={{ duration: 0.45, ease: easePop }}
                  />
                </div>
              </motion.div>

              <motion.div className="grid grid-cols-2 gap-2" variants={listSequence}>
                <motion.div
                  className="rounded-2xl border border-b-2 border-gray-100 bg-white px-2.5 py-2.5 text-center shadow-sm"
                  variants={popItem}
                >
                  <Users className="mx-auto size-5 text-primary" strokeWidth={2.5} />
                  <motion.p
                    className="mt-1 text-xl font-extrabold tabular-nums text-gray-900"
                    initial="intro"
                    animate={positionPhase}
                    variants={positionPop}
                  >
                    {isAdvanced ? "3" : "4"}
                  </motion.p>
                  <p className="text-sm font-bold text-gray-500">na frente</p>
                </motion.div>
                <motion.div
                  className="rounded-2xl border border-b-2 border-gray-100 bg-white px-2.5 py-2.5 text-center shadow-sm"
                  variants={popItem}
                >
                  <Clock className="mx-auto size-5 text-primary" strokeWidth={2.5} />
                  <p className="mt-1 text-xl font-extrabold tabular-nums text-gray-900">~18</p>
                  <p className="text-sm font-bold text-gray-500">min</p>
                </motion.div>
              </motion.div>
            </motion.div>
          </PhoneFrame>

          <motion.div
            className="absolute inset-x-6 -bottom-5 z-20 sm:inset-x-8 sm:-bottom-6"
            initial="idle"
            animate={contentPhase}
            variants={footerVariants}
          >
            <div className="flex items-center justify-center gap-1.5 rounded-xl border border-b-[3px] border-primary-700 bg-primary px-3 py-2 shadow-md">
              <ArrowUp className="size-3.5 shrink-0 text-white" strokeWidth={3} />
              <p className="text-sm font-extrabold text-white">você avançou!</p>
            </div>
          </motion.div>
        </motion.div>
      </IllustrationScene>
    </IllustrationStage>
  );
}
