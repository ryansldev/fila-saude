"use client";

import { AlertTriangle, Check, Siren } from "lucide-react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { easeInOut, easePop, inViewViewportLoop, lottieSleep } from "@/lib/motion";
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

type StoryPhase = "idle" | "static" | "reset" | "intro" | "select" | "result";

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
  result: { transition: { staggerChildren: 0.08, delayChildren: 0.04 } },
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
  select: { opacity: 0.38, scale: 0.97, transition: { duration: 0.22 } },
  result: { opacity: 0.38, scale: 0.97 },
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
  select: {
    opacity: 1,
    scale: [1, 1.05, 1],
    transition: { duration: 0.38, ease: easePop },
  },
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

const footerCard = {
  idle: { scale: 0.92, y: 16, opacity: 0 },
  static: { scale: 1, y: 0, opacity: 1 },
  reset: { scale: 0.92, y: 16, opacity: 0, transition: { duration: 0.2, ease: easeInOut } },
  intro: { scale: 0.92, y: 16, opacity: 0 },
  select: { scale: 0.9, y: 14, opacity: 0 },
  result: {
    opacity: [0, 1, 1],
    scale: [0.88, 1.08, 1],
    y: [20, 0],
    transition: { duration: 0.52, ease: easePop },
  },
};

const footerHint = {
  idle: { scale: 0.9, y: 12, opacity: 0 },
  static: { scale: 1, y: 0, opacity: 0.9 },
  reset: { scale: 0.9, y: 12, opacity: 0, transition: { duration: 0.2, ease: easeInOut } },
  intro: { scale: 0.9, y: 12, opacity: 0 },
  select: { scale: 0.9, y: 12, opacity: 0 },
  result: {
    opacity: [0, 0.9, 0.9],
    scale: [0.9, 1.04, 1],
    y: [12, 0],
    transition: { duration: 0.45, ease: easePop, delay: 0.12 },
  },
};

const RESET_MS = 360;
const INTRO_MS = 1550;
const SELECT_MS = 520;
const RESULT_MS = 2100;

export function UrgencyCheckIllustration() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, inViewViewportLoop);
  const prefersReducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<StoryPhase>("idle");

  const looping = isInView && !prefersReducedMotion;
  const animatePhase = prefersReducedMotion ? "static" : looping ? phase : "idle";
  const isNoneSelected =
    animatePhase === "select" || animatePhase === "result" || animatePhase === "static";

  useEffect(() => {
    if (!looping) {
      setPhase("idle");
      return;
    }

    let cancelled = false;
    let isFirstCycle = true;

    (async () => {
      while (!cancelled) {
        if (!isFirstCycle) {
          setPhase("reset");
          await lottieSleep(RESET_MS);
          if (cancelled) break;
        }
        isFirstCycle = false;

        setPhase("intro");
        await lottieSleep(INTRO_MS);
        if (cancelled) break;

        setPhase("select");
        await lottieSleep(SELECT_MS);
        if (cancelled) break;

        setPhase("result");
        await lottieSleep(RESULT_MS);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [looping]);

  return (
    <IllustrationStage tone="yellow">
      <IllustrationScene className="pb-32 sm:pb-36">
        <div ref={ref} className="relative">
          <motion.div
            className={cn(floatingBadgeClasses("right"), "inline-flex")}
            initial="idle"
            animate={animatePhase}
            variants={badgeVariants}
          >
            <AlertTriangle className="size-4 text-yellow-600" strokeWidth={2.5} />
            <span className="text-sm font-bold text-gray-700">pré-triagem</span>
          </motion.div>

          <PhoneFrame>
            <motion.div
              className="space-y-3 px-1 pb-2 pt-1"
              initial="idle"
              animate={animatePhase}
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
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-3 py-3 shadow-sm transition-colors duration-200",
                  isNoneSelected
                    ? "border-2 border-green-500 bg-green-50"
                    : "border border-b-2 border-gray-100 bg-white",
                )}
                variants={noneRow}
              >
                <motion.span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors duration-200",
                    isNoneSelected
                      ? "border-green-600 bg-green-500 text-white"
                      : "border-gray-300 bg-white",
                  )}
                  variants={checkPop}
                >
                  {isNoneSelected ? <Check className="size-3.5" strokeWidth={3} /> : null}
                </motion.span>
                <span
                  className={cn(
                    "min-w-0 flex-1 text-sm font-bold lowercase",
                    isNoneSelected ? "font-extrabold text-green-900" : "text-gray-800",
                  )}
                >
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
        </div>

        <motion.div
          className="absolute inset-x-0 bottom-0 space-y-1.5"
          initial="idle"
          animate={animatePhase}
          variants={introSequence}
          aria-hidden={animatePhase !== "result" && animatePhase !== "static"}
        >
          <motion.div
            className="rounded-2xl border border-b-4 border-green-700 bg-green-500 px-3 py-2.5 shadow-[0_16px_32px_-10px_rgba(34,197,94,0.55)] sm:px-4 sm:py-3"
            variants={footerCard}
          >
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/20 text-white">
                <Check className="size-4" strokeWidth={3} />
              </span>
              <div className="min-w-0 text-white">
                <p className="text-sm font-extrabold sm:text-base">sem sinais urgentes</p>
                <p className="truncate text-sm text-green-50">caminho leve · UBS</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            className="flex items-center gap-2 rounded-xl border border-b-2 border-orange-200 bg-orange-50 px-3 py-2"
            variants={footerHint}
          >
            <Siren className="size-4 shrink-0 text-orange-600" strokeWidth={2.5} />
            <p className="min-w-0 text-sm font-bold text-orange-900">
              sinal urgente ou outro → <span className="font-extrabold">UPA</span>
            </p>
          </motion.div>
        </motion.div>
      </IllustrationScene>
    </IllustrationStage>
  );
}
