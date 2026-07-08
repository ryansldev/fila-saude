"use client";

import { AlertTriangle, Check } from "lucide-react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { useRef } from "react";

import { type AnimatePhase, easeInOut, easePop, illustrationLevitate, inViewViewportLoop } from "@/lib/motion";
import { useStandardPhaseLoop } from "@/lib/use-standard-phase-loop";
import { cn } from "@/lib/utils";

import {
  floatingBadgeClasses,
  IllustrationScene,
  IllustrationStage,
  PhoneFrame,
  primaryCtaBarClasses,
} from "../illustration-stage";

const urgentSigns = [
  { id: "ar", label: "falta de ar forte" },
  { id: "peito", label: "dor forte no peito" },
  { id: "desmaio", label: "desmaio ou confusão" },
  { id: "sangue", label: "sangramento que não para" },
  { id: "convulsao", label: "convulsão" },
] as const;

const hiddenItem = { scale: 0.92, y: 10, opacity: 0 };
const stableItem = { scale: 1, y: 0, opacity: 1 };

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
  float: { scale: 1, y: 0, rotate: 0, opacity: 1 },
} satisfies Record<AnimatePhase, object>;

const introSequence = {
  idle: {},
  static: {},
  reset: {},
  intro: { transition: { staggerChildren: 0.07, delayChildren: 0.06 } },
  select: {},
  result: {},
  float: {},
} satisfies Record<AnimatePhase, object>;

const popItem = {
  idle: hiddenItem,
  static: stableItem,
  reset: { ...hiddenItem, transition: { duration: 0.2, ease: easeInOut } },
  intro: {
    opacity: [0, 1, 1],
    scale: [0.82, 1.06, 1],
    y: [12, -3, 0],
    transition: { duration: 0.44, ease: easePop },
  },
  select: stableItem,
  result: stableItem,
  float: stableItem,
} satisfies Record<AnimatePhase, object>;

const listSequence = {
  idle: {},
  static: {},
  reset: {},
  intro: { transition: { staggerChildren: 0.05, delayChildren: 0.02 } },
  select: {},
  result: {},
  float: {},
} satisfies Record<AnimatePhase, object>;

const noneRow = {
  idle: hiddenItem,
  static: stableItem,
  reset: { ...hiddenItem, transition: { duration: 0.2, ease: easeInOut } },
  intro: {
    opacity: [0, 1, 1],
    scale: [0.82, 1.06, 1],
    y: [12, -3, 0],
    transition: { duration: 0.44, ease: easePop },
  },
  select: stableItem,
  result: stableItem,
  float: stableItem,
} satisfies Record<AnimatePhase, object>;

const checkPop = {
  idle: { scale: 0, opacity: 0 },
  static: { scale: 1, opacity: 1 },
  reset: { scale: 0, opacity: 0, transition: { duration: 0.15 } },
  intro: { scale: 0, opacity: 0 },
  select: {
    scale: [0, 1.3, 1],
    opacity: 1,
    transition: { duration: 0.42, ease: easePop },
  },
  result: { scale: 1, opacity: 1 },
  float: { scale: 1, opacity: 1 },
} satisfies Record<AnimatePhase, object>;

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
  float: { scale: 1, y: 0, opacity: 1 },
} satisfies Record<AnimatePhase, object>;

const PHASE_DURATIONS = {
  intro: 650,
  select: 320,
  result: 500,
} as const;

export function UrgencyCheckIllustration() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, inViewViewportLoop);
  const prefersReducedMotion = useReducedMotion();
  const { contentPhase, levitating } = useStandardPhaseLoop(isInView, !!prefersReducedMotion, PHASE_DURATIONS);

  const isNoneChecked = contentPhase === "select" || contentPhase === "result" || contentPhase === "static";

  const checkPhase =
    contentPhase === "idle" || contentPhase === "intro" ? "intro" : contentPhase === "select" ? "select" : "result";

  return (
    <IllustrationStage tone="yellow">
      <IllustrationScene>
        <motion.div ref={ref} className="relative" animate={levitating ? illustrationLevitate : { y: 0 }}>
          <motion.div
            className={cn(floatingBadgeClasses("right"), "inline-flex")}
            initial="idle"
            animate={contentPhase}
            variants={badgeVariants}
          >
            <AlertTriangle className="size-4 text-yellow-600" strokeWidth={2.5} />
            <span className="text-sm font-bold text-gray-700">pré-triagem</span>
          </motion.div>

          <PhoneFrame>
            <div aria-hidden>
              <motion.div
                className="space-y-3 px-1 pb-2 pt-1"
                initial="idle"
                animate={contentPhase}
                variants={introSequence}
              >
                <motion.div variants={popItem}>
                  <p className="text-lg font-extrabold lowercase leading-tight text-gray-900">
                    tem algum sinal urgente?
                  </p>
                  <p className="mt-1 text-sm text-gray-500">marque o que estiver sentindo agora</p>
                </motion.div>

                <motion.div
                  className="overflow-hidden rounded-2xl border border-b-2 border-gray-100 bg-white shadow-sm"
                  variants={listSequence}
                >
                  {urgentSigns.map((sign, index) => (
                    <motion.div
                      key={sign.id}
                      className={cn(
                        "flex items-center gap-3 px-3 py-3",
                        index < urgentSigns.length - 1 && "border-b border-gray-100",
                      )}
                      variants={popItem}
                    >
                      <span className="flex size-5 shrink-0 rounded-md border-2 border-gray-300 bg-white" />
                      <span className="min-w-0 flex-1 text-sm font-bold lowercase text-gray-800">{sign.label}</span>
                    </motion.div>
                  ))}
                </motion.div>

                <motion.div
                  className="flex items-center gap-3 rounded-2xl border border-b-2 border-gray-100 bg-white px-3 py-3 shadow-sm"
                  variants={popItem}
                >
                  <span className="flex size-5 shrink-0 rounded-md border-2 border-gray-300 bg-white" />
                  <span className="min-w-0 flex-1 text-sm font-bold lowercase text-gray-800">outro</span>
                </motion.div>

                <motion.div
                  className="flex items-center gap-3 rounded-2xl border border-b-2 border-gray-100 bg-white px-3 py-3 shadow-sm"
                  variants={noneRow}
                >
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors duration-200",
                      isNoneChecked ? "border-green-600 bg-green-500 text-white" : "border-gray-300 bg-white",
                    )}
                  >
                    <motion.span
                      className="flex items-center justify-center"
                      initial="intro"
                      animate={checkPhase}
                      variants={checkPop}
                    >
                      <Check className="size-3.5" strokeWidth={3} />
                    </motion.span>
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-bold lowercase text-gray-800">nenhum desses</span>
                </motion.div>

                <motion.div className={primaryCtaBarClasses} variants={ctaVariants}>
                  continuar
                </motion.div>

                <motion.p className="text-center text-sm leading-snug text-gray-400" variants={popItem}>
                  na unidade, o enfermeiro faz a classificação oficial
                </motion.p>
              </motion.div>
            </div>
          </PhoneFrame>
        </motion.div>
      </IllustrationScene>
    </IllustrationStage>
  );
}
