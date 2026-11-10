"use client";

import { Bell, Clock, House, Users } from "lucide-react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { useRef } from "react";

import {
  badgeVariants,
  emphasisScaleVariant,
  footerVariants,
  illustrationLevitate,
  illustrationRest,
  introSequence,
  inViewViewportLoop,
  listSequence,
  popItem,
} from "@/lib/motion";
import { useStandardPhaseLoop } from "@/lib/use-standard-phase-loop";
import { cn } from "@/lib/utils";

import {
  floatingBadgeClasses,
  IllustrationScene,
  IllustrationStage,
  PhoneFrame,
  PhoneQueueHeader,
} from "../illustration-stage";

const PHASE_DURATIONS = {
  intro: 650,
  select: 300,
  result: 500,
} as const;

export function QueuePositionIllustration() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, inViewViewportLoop);
  const prefersReducedMotion = useReducedMotion();
  const { contentPhase, levitating } = useStandardPhaseLoop(isInView, !!prefersReducedMotion, PHASE_DURATIONS);

  const isAdvanced = contentPhase === "select" || contentPhase === "result" || contentPhase === "static";
  const positionPhase =
    contentPhase === "idle" || contentPhase === "intro" ? "intro" : contentPhase === "select" ? "select" : "result";

  return (
    <IllustrationStage tone="yellow">
      <IllustrationScene className="pb-[5.5rem] sm:pb-[6.6rem]">
        <motion.div ref={ref} className="relative" animate={levitating ? illustrationLevitate : illustrationRest}>
          <motion.div
            className={cn(floatingBadgeClasses("right"), "inline-flex")}
            initial="idle"
            animate={contentPhase}
            variants={badgeVariants}
          >
            <House className="size-[1.1rem] text-primary" strokeWidth={2.5} />
            <span className="text-[0.9625rem] font-bold text-gray-700">em casa</span>
          </motion.div>

          <PhoneFrame>
            <motion.div
              className="space-y-3 px-1 pb-2 pt-1"
              initial="idle"
              animate={contentPhase}
              variants={introSequence}
            >
              <motion.div variants={popItem}>
                <PhoneQueueHeader ticket="C-003" />
              </motion.div>

              <motion.div
                className="rounded-2xl border border-b-4 border-primary-200 bg-primary-50 px-4 py-5 text-center"
                variants={popItem}
              >
                <p className="text-[0.9625rem] font-bold lowercase tracking-wide text-primary-700">você é o</p>
                <motion.p
                  className="mt-1 text-[4.125rem] font-extrabold leading-none text-primary tabular-nums sm:text-[6.6rem] lg:text-[8.8rem]"
                  initial="intro"
                  animate={positionPhase}
                  variants={emphasisScaleVariant}
                >
                  {isAdvanced ? "2º" : "3º"}
                </motion.p>
                <p className="mt-2 text-[0.9625rem] font-bold lowercase tracking-wide text-gray-500">a ser chamado</p>
              </motion.div>

              <motion.div className="grid grid-cols-2 gap-2" variants={listSequence}>
                <motion.div
                  className="rounded-2xl border border-b-2 border-gray-100 bg-white px-2.5 py-2.5 text-center shadow-sm"
                  variants={popItem}
                >
                  <Users className="mx-auto size-[1.375rem] text-primary" strokeWidth={2.5} />
                  <motion.p
                    className="mt-1 text-[1.375rem] font-extrabold tabular-nums text-gray-900"
                    initial="intro"
                    animate={positionPhase}
                    variants={emphasisScaleVariant}
                  >
                    {isAdvanced ? "1" : "2"}
                  </motion.p>
                  <p className="text-[0.9625rem] font-bold text-gray-500">na frente</p>
                </motion.div>
                <motion.div
                  className="rounded-2xl border border-b-2 border-gray-100 bg-white px-2.5 py-2.5 text-center shadow-sm"
                  variants={popItem}
                >
                  <Clock className="mx-auto size-[1.375rem] text-primary" strokeWidth={2.5} />
                  <p className="mt-1 text-[1.375rem] font-extrabold tabular-nums text-gray-900">
                    ~{isAdvanced ? "15" : "30"}
                  </p>
                  <p className="text-[0.9625rem] font-bold text-gray-500">min</p>
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
            <div className="flex items-center justify-center gap-1.5 rounded-xl border border-b-[3px] border-green-700 bg-green-500 px-3 py-2 shadow-md">
              <Bell className="size-[0.9625rem] shrink-0 text-white" strokeWidth={3} />
              <p className="text-[0.9625rem] font-extrabold text-white">saia de casa agora!</p>
            </div>
          </motion.div>
        </motion.div>
      </IllustrationScene>
    </IllustrationStage>
  );
}
