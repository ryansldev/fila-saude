"use client";

import { ChevronLeft, Info } from "lucide-react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { easeInOut, easePop, illustrationLevitate, inViewViewportLoop, lottieSleep } from "@/lib/motion";
import { cn } from "@/lib/utils";

import {
  floatingBadgeClasses,
  IllustrationScene,
  IllustrationStage,
  PhoneFrame,
  PhoneQueueHeader,
} from "../illustration-stage";

const aheadRows = [
  { position: 1, ticket: "004", reason: "idoso", preferential: true },
  { position: 2, ticket: "011", reason: "gestante", preferential: true },
  { position: 3, ticket: "012", reason: "chegou antes", preferential: false },
] as const;

const userTicket = "013";

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

const countPress = {
  intro: { scale: 1 },
  static: { scale: 1 },
  select: {
    scale: [1, 0.92, 1],
    transition: { duration: 0.38, ease: easePop },
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

const INTRO_MS = 1850;
const SELECT_MS = 520;
const RESULT_MS = 900;

export function QueueTransparencyIllustration() {
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

  const tapPhase =
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
    <IllustrationStage tone="primary">
      <IllustrationScene className="pb-20 sm:pb-24">
        <motion.div
          ref={ref}
          className="relative"
          animate={levitating ? illustrationLevitate : { y: 0 }}
        >
          <motion.div
            className={cn(floatingBadgeClasses("left"), "inline-flex")}
            initial="idle"
            animate={contentPhase}
            variants={badgeVariants}
          >
            <Info className="size-4 text-primary" strokeWidth={2.5} />
            <span className="text-sm font-bold text-gray-700">tudo claro</span>
          </motion.div>

          <PhoneFrame>
            <motion.div
              className="space-y-3 px-1 pb-2 pt-1"
              initial="idle"
              animate={contentPhase}
              variants={introSequence}
            >
              <motion.div
                className="flex items-center gap-1 text-sm font-extrabold lowercase text-primary"
                variants={popItem}
              >
                <ChevronLeft className="size-4" strokeWidth={2.5} />
                sua posição
              </motion.div>

              <motion.div variants={popItem}>
                <PhoneQueueHeader
                  ticket={userTicket}
                  className="rounded-2xl border border-b-2 border-gray-100 bg-white px-3 py-2.5 shadow-sm"
                />
              </motion.div>

              <motion.div className="flex items-center justify-between" variants={popItem}>
                <p className="text-sm font-bold lowercase tracking-wide text-gray-500">na sua frente</p>
                <motion.span
                  className="rounded-full bg-primary-50 px-2.5 py-0.5 text-sm font-extrabold tabular-nums text-primary"
                  initial="intro"
                  animate={tapPhase}
                  variants={countPress}
                >
                  3
                </motion.span>
              </motion.div>

              <motion.div className="space-y-1.5" variants={listSequence}>
                {aheadRows.map((row) => (
                  <motion.div
                    key={row.ticket}
                    className="flex items-center gap-2.5 rounded-xl border border-b-2 border-gray-100 bg-white px-3 py-2.5 shadow-sm"
                    variants={popItem}
                  >
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-white",
                        row.preferential ? "bg-orange-500" : "bg-gray-300",
                      )}
                    >
                      {row.position}º
                    </span>
                    <p className="font-mono text-sm font-extrabold tabular-nums text-gray-800">senha {row.ticket}</p>
                    <span
                      className={cn(
                        "ml-auto shrink-0 rounded-full px-2 py-0.5 text-xs font-bold lowercase sm:px-2.5 sm:text-sm",
                        row.preferential ? "bg-orange-100 text-orange-800" : "bg-gray-100 text-gray-700",
                      )}
                    >
                      {row.reason}
                    </span>
                  </motion.div>
                ))}

                <motion.div
                  className="rounded-xl border-2 border-primary bg-primary-50 px-3 py-2.5"
                  variants={popItem}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-extrabold text-white">
                      4º
                    </span>
                    <p className="font-mono text-sm font-extrabold tabular-nums text-primary-900">
                      senha {userTicket}
                    </p>
                    <span className="text-sm font-extrabold text-primary-800">você</span>
                    <span className="ml-auto rounded-full bg-white px-2.5 py-0.5 text-sm font-bold lowercase text-primary-700">
                      consulta
                    </span>
                  </div>
                </motion.div>
              </motion.div>

              <motion.p className="text-center text-sm text-gray-500" variants={popItem}>
                preferência legal primeiro, depois ordem de senha
              </motion.p>
            </motion.div>
          </PhoneFrame>

          <motion.div
            className="absolute inset-x-6 -bottom-5 z-20 sm:inset-x-8 sm:-bottom-6"
            initial="idle"
            animate={contentPhase}
            variants={footerVariants}
          >
            <div className="flex items-center justify-center gap-1.5 rounded-xl border border-b-[3px] border-primary-700 bg-primary px-3 py-2 shadow-md">
              <Info className="size-3.5 shrink-0 text-white" strokeWidth={3} />
              <p className="text-sm font-extrabold text-white">agora faz sentido!</p>
            </div>
          </motion.div>
        </motion.div>
      </IllustrationScene>
    </IllustrationStage>
  );
}
