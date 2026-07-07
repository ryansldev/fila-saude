"use client";

import { Stethoscope, User } from "lucide-react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { useRef } from "react";

import {
  easeInOut,
  easePop,
  illustrationLevitate,
  inViewViewportLoop,
} from "@/lib/motion";
import { useStandardPhaseLoop } from "@/lib/use-standard-phase-loop";
import { cn } from "@/lib/utils";

import {
  floatingBadgeClasses,
  IllustrationScene,
  IllustrationStage,
  PhoneFrame,
  primaryCtaBarClasses,
} from "../illustration-stage";

const whoOptions = [
  { id: "voce", label: "você", selected: true },
  { id: "outra", label: "outra pessoa", selected: false },
] as const;

const needOptions = [
  { id: "consulta", label: "consulta", selected: true },
  { id: "exame", label: "exame", selected: false },
] as const;

const symptomTags = ["febre", "dor de cabeça", "mal-estar"] as const;

const MOTION_TEXT = "febre desde ontem, dor de cabeça e mal-estar";

const easeReveal = [0.22, 1, 0.36, 1] as const;

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

const textRevealVariants = {
  intro: { clipPath: "inset(0 100% 0 0)" },
  static: { clipPath: "inset(0 0% 0 0)" },
  select: {
    clipPath: ["inset(0 100% 0 0)", "inset(0 0% 0 0)"],
    transition: { duration: 0.8, ease: easeReveal },
  },
  result: { clipPath: "inset(0 0% 0 0)" },
};

const ctaVariants = {
  idle: { scale: 0.86, y: 14, opacity: 0 },
  static: { scale: 1, y: 0, opacity: 1 },
  reset: { scale: 0.86, y: 14, opacity: 0, transition: { duration: 0.2, ease: easeInOut } },
  intro: { scale: 0.86, y: 14, opacity: 0 },
  select: { scale: 0.86, y: 14, opacity: 0 },
  result: {
    opacity: [0, 1, 1],
    scale: [0.86, 1.06, 1],
    y: [14, 0],
    transition: { duration: 0.5, ease: easePop },
  },
};

const PHASE_DURATIONS = {
  intro: 1650,
  select: 900,
  result: 800,
} as const;

export function SymptomInputIllustration() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, inViewViewportLoop);
  const prefersReducedMotion = useReducedMotion();
  const { contentPhase, levitating } = useStandardPhaseLoop(isInView, !!prefersReducedMotion, PHASE_DURATIONS);

  const textPhase =
    contentPhase === "idle" || contentPhase === "intro"
      ? "intro"
      : contentPhase === "select"
        ? "select"
        : "result";

  return (
    <IllustrationStage tone="green">
      <IllustrationScene>
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
            <Stethoscope className="size-4 text-primary" strokeWidth={2.5} />
            <span className="text-sm font-bold text-gray-700">primeiro passo</span>
          </motion.div>

          <PhoneFrame>
            <motion.div
              className="space-y-3 px-1 pb-2 pt-1"
              initial="idle"
              animate={contentPhase}
              variants={introSequence}
            >
              <motion.p className="text-sm font-bold lowercase tracking-wide text-gray-500" variants={popItem}>
                pra quem é?
              </motion.p>

              <motion.div className="flex flex-wrap gap-1.5" variants={listSequence}>
                {whoOptions.map((option) => (
                  <motion.span
                    key={option.id}
                    className={
                      option.selected
                        ? "inline-flex items-center gap-1 rounded-full border-b-[3px] border-primary-700 bg-primary px-2.5 py-1.5 text-sm font-extrabold lowercase text-white shadow-sm"
                        : "inline-flex rounded-full border border-b-2 border-gray-200 bg-white px-2.5 py-1.5 text-sm font-bold lowercase text-gray-600"
                    }
                    variants={popItem}
                  >
                    {option.selected ? <User className="size-3.5" strokeWidth={2.5} /> : null}
                    {option.label}
                  </motion.span>
                ))}
              </motion.div>

              <motion.p className="text-sm font-bold lowercase tracking-wide text-gray-500" variants={popItem}>
                do que precisa?
              </motion.p>

              <motion.div className="flex flex-wrap gap-1.5" variants={listSequence}>
                {needOptions.map((option) => (
                  <motion.span
                    key={option.id}
                    className={
                      option.selected
                        ? "inline-flex rounded-full border-b-[3px] border-primary-700 bg-primary px-2.5 py-1.5 text-sm font-extrabold lowercase text-white shadow-sm"
                        : "inline-flex rounded-full border border-b-2 border-gray-200 bg-white px-2.5 py-1.5 text-sm font-bold lowercase text-gray-600"
                    }
                    variants={popItem}
                  >
                    {option.label}
                  </motion.span>
                ))}
              </motion.div>

              <motion.p className="text-sm font-bold lowercase tracking-wide text-gray-500" variants={popItem}>
                conta o motivo
              </motion.p>

              <motion.div
                className="space-y-2 rounded-2xl border border-b-2 border-gray-100 bg-white p-2.5 shadow-sm"
                variants={popItem}
              >
                <div className="min-h-14 overflow-hidden rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                  <motion.p
                    className="text-sm leading-relaxed text-gray-600"
                    initial="intro"
                    animate={textPhase}
                    variants={textRevealVariants}
                  >
                    {MOTION_TEXT}
                  </motion.p>
                </div>

                <motion.div className="flex flex-wrap gap-1.5" variants={listSequence}>
                  {symptomTags.map((tag) => (
                    <motion.span
                      key={tag}
                      className="inline-flex rounded-full border border-primary-200 bg-primary-50 px-2.5 py-1 text-sm font-bold lowercase text-primary-800"
                      variants={popItem}
                    >
                      {tag}
                    </motion.span>
                  ))}
                </motion.div>
              </motion.div>

              <motion.div className={primaryCtaBarClasses} variants={ctaVariants}>
                continuar
              </motion.div>
            </motion.div>
          </PhoneFrame>
        </motion.div>
      </IllustrationScene>
    </IllustrationStage>
  );
}
