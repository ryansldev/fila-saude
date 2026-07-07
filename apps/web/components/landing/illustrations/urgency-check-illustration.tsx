"use client";

import { AlertTriangle, Check } from "lucide-react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { easeInOut, easePop, illustrationLevitate, inViewViewportLoop, lottieSleep } from "@/lib/motion";
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

type StoryPhase = "idle" | "static" | "intro" | "select" | "result" | "float";

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

const noneRow = {
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

const INTRO_MS = 1550;
const SELECT_MS = 520;
const RESULT_MS = 800;

export function UrgencyCheckIllustration() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, inViewViewportLoop);
  const prefersReducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<StoryPhase>("idle");
  const [storyDone, setStoryDone] = useState(false);

  const contentPhase = prefersReducedMotion
    ? "static"
    : storyDone || phase === "float" || phase === "result"
      ? "result"
      : phase;

  const isNoneChecked =
    contentPhase === "select" || contentPhase === "result" || contentPhase === "static";

  const checkPhase =
    contentPhase === "idle" || contentPhase === "intro"
      ? "intro"
      : contentPhase === "select"
        ? "select"
        : "result";

  const levitating = isInView && storyDone && !prefersReducedMotion;

  useEffect(() => {
    if (!isInView && !storyDone) {
      setPhase("idle");
    }
  }, [isInView, storyDone]);

  useEffect(() => {
    if (prefersReducedMotion || !isInView || storyDone) return;

    let cancelled = false;

    (async () => {
      setPhase("intro");
      await lottieSleep(INTRO_MS);
      if (cancelled) return;

      setPhase("select");
      await lottieSleep(SELECT_MS);
      if (cancelled) return;

      setPhase("result");
      await lottieSleep(RESULT_MS);
      if (cancelled) return;

      setStoryDone(true);
      setPhase("float");
    })();

    return () => {
      cancelled = true;
    };
  }, [isInView, prefersReducedMotion, storyDone]);

  return (
    <IllustrationStage tone="yellow">
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
            <AlertTriangle className="size-4 text-yellow-600" strokeWidth={2.5} />
            <span className="text-sm font-bold text-gray-700">pré-triagem</span>
          </motion.div>

          <PhoneFrame>
            <motion.div
              className="space-y-3 px-1 pb-2 pt-1"
              initial="idle"
              animate={contentPhase}
              variants={introSequence}
            >
              <motion.div variants={popItem}>
                <p className="text-lg font-extrabold lowercase leading-tight text-gray-900">tem algum sinal urgente?</p>
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
                    isNoneChecked
                      ? "border-green-600 bg-green-500 text-white"
                      : "border-gray-300 bg-white",
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
                <span className="min-w-0 flex-1 text-sm font-bold lowercase text-gray-800">
                  nenhum desses
                </span>
              </motion.div>

              <motion.div className={primaryCtaBarClasses} variants={ctaVariants}>
                continuar
              </motion.div>

              <motion.p className="text-center text-sm leading-snug text-gray-400" variants={popItem}>
                na unidade, o enfermeiro faz a classificação oficial
              </motion.p>
            </motion.div>
          </PhoneFrame>
        </motion.div>
      </IllustrationScene>
    </IllustrationStage>
  );
}
