"use client";

import { Stethoscope, User } from "lucide-react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { illustrationLevitate, inViewViewportLoop } from "@/lib/motion";
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

const easePop = [0.34, 1.45, 0.64, 1] as const;
const easeReveal = [0.22, 1, 0.36, 1] as const;

const passThrough = {
  rest: {},
  play: {},
};

const item = {
  rest: { scale: 1, y: 0 },
  play: {
    scale: [0.8, 1.05, 1],
    y: [14, -2, 0],
    transition: { duration: 0.5, ease: easePop },
  },
};

const sequence = {
  rest: {},
  play: {
    transition: { staggerChildren: 0.1, delayChildren: 0.08 },
  },
};

const badgeVariants = {
  rest: { scale: 1, y: 0, rotate: 0 },
  play: {
    scale: [0.65, 1.08, 1],
    y: [-18, 0],
    rotate: [-10, 0],
    transition: { duration: 0.55, ease: easePop },
  },
};

const textBoxVariants = {
  rest: { scale: 1, y: 0 },
  play: {
    scale: [0.94, 1],
    y: [10, 0],
    transition: { duration: 0.45, ease: easePop },
  },
};

const textRevealVariants = {
  rest: { clipPath: "inset(0 0% 0 0)" },
  play: {
    clipPath: ["inset(0 100% 0 0)", "inset(0 0% 0 0)"],
    transition: { duration: 0.8, ease: easeReveal },
  },
};

const continueVariants = {
  rest: { scale: 1, y: 0 },
  play: {
    scale: [0.88, 1.04, 1],
    y: [16, 0],
    transition: { duration: 0.55, ease: easePop },
  },
};

const PLAY_MS = 2200;

export function SymptomInputIllustration() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, inViewViewportLoop);
  const prefersReducedMotion = useReducedMotion();
  const [storyDone, setStoryDone] = useState(false);

  const contentPhase =
    prefersReducedMotion || storyDone ? "rest" : isInView ? "play" : "rest";
  const levitating = isInView && storyDone && !prefersReducedMotion;

  useEffect(() => {
    if (prefersReducedMotion || !isInView || storyDone) return;

    const timer = window.setTimeout(() => setStoryDone(true), PLAY_MS);
    return () => window.clearTimeout(timer);
  }, [isInView, prefersReducedMotion, storyDone]);

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
            initial="rest"
            animate={contentPhase}
            variants={badgeVariants}
          >
            <Stethoscope className="size-4 text-primary" strokeWidth={2.5} />
            <span className="text-sm font-bold text-gray-700">primeiro passo</span>
          </motion.div>

          <PhoneFrame>
            <motion.div className="space-y-3 px-1 pb-2 pt-1" initial="rest" animate={contentPhase} variants={sequence}>
              <motion.p className="text-sm font-bold lowercase tracking-wide text-gray-500" variants={item}>
                pra quem é?
              </motion.p>

              <motion.div className="flex flex-wrap gap-1.5" variants={passThrough}>
                {whoOptions.map((option) => (
                  <motion.span
                    key={option.id}
                    className={
                      option.selected
                        ? "inline-flex items-center gap-1 rounded-full border-b-[3px] border-primary-700 bg-primary px-2.5 py-1.5 text-sm font-extrabold lowercase text-white shadow-sm"
                        : "inline-flex rounded-full border border-b-2 border-gray-200 bg-white px-2.5 py-1.5 text-sm font-bold lowercase text-gray-600"
                    }
                    variants={item}
                  >
                    {option.selected ? <User className="size-3.5" strokeWidth={2.5} /> : null}
                    {option.label}
                  </motion.span>
                ))}
              </motion.div>

              <motion.p className="text-sm font-bold lowercase tracking-wide text-gray-500" variants={item}>
                do que precisa?
              </motion.p>

              <motion.div className="flex flex-wrap gap-1.5" variants={passThrough}>
                {needOptions.map((option) => (
                  <motion.span
                    key={option.id}
                    className={
                      option.selected
                        ? "inline-flex rounded-full border-b-[3px] border-primary-700 bg-primary px-2.5 py-1.5 text-sm font-extrabold lowercase text-white shadow-sm"
                        : "inline-flex rounded-full border border-b-2 border-gray-200 bg-white px-2.5 py-1.5 text-sm font-bold lowercase text-gray-600"
                    }
                    variants={item}
                  >
                    {option.label}
                  </motion.span>
                ))}
              </motion.div>

              <motion.p className="text-sm font-bold lowercase tracking-wide text-gray-500" variants={item}>
                conta o motivo
              </motion.p>

              <motion.div
                className="space-y-2 rounded-2xl border border-b-2 border-gray-100 bg-white p-2.5 shadow-sm"
                variants={textBoxVariants}
              >
                <div className="min-h-14 overflow-hidden rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                  <motion.p className="text-sm leading-relaxed text-gray-600" variants={textRevealVariants}>
                    {MOTION_TEXT}
                  </motion.p>
                </div>

                <motion.div className="flex flex-wrap gap-1.5" variants={passThrough}>
                  {symptomTags.map((tag) => (
                    <motion.span
                      key={tag}
                      className="inline-flex rounded-full border border-primary-200 bg-primary-50 px-2.5 py-1 text-sm font-bold lowercase text-primary-800"
                      variants={item}
                    >
                      {tag}
                    </motion.span>
                  ))}
                </motion.div>
              </motion.div>

              <motion.div className={primaryCtaBarClasses} variants={continueVariants}>
                continuar
              </motion.div>
            </motion.div>
          </PhoneFrame>
        </motion.div>
      </IllustrationScene>
    </IllustrationStage>
  );
}
