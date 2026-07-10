"use client";

import { Bell } from "lucide-react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { useRef } from "react";

import { BrandName } from "@/components/landing/brand-name";
import {
  badgeVariants,
  bellRingVariant,
  footerVariants,
  illustrationLevitate,
  illustrationRest,
  introSequence,
  inViewViewportLoop,
  popItem,
} from "@/lib/motion";
import { useStandardPhaseLoop } from "@/lib/use-standard-phase-loop";
import { cn } from "@/lib/utils";

import { floatingBadgeClasses, IllustrationScene, IllustrationStage, PhoneFrame } from "../illustration-stage";

const PHASE_DURATIONS = {
  intro: 550,
  select: 320,
  result: 500,
} as const;

export function NotificationIllustration() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, inViewViewportLoop);
  const prefersReducedMotion = useReducedMotion();
  const { contentPhase, levitating } = useStandardPhaseLoop(isInView, !!prefersReducedMotion, PHASE_DURATIONS);

  const bellPhase =
    contentPhase === "idle" || contentPhase === "intro" ? "intro" : contentPhase === "select" ? "select" : "result";

  return (
    <IllustrationStage tone="green">
      <IllustrationScene className="pb-[5.5rem] sm:pb-[6.6rem]">
        <motion.div ref={ref} className="relative" animate={levitating ? illustrationLevitate : illustrationRest}>
          <motion.div
            className={cn(floatingBadgeClasses("right"), "inline-flex")}
            initial="idle"
            animate={contentPhase}
            variants={badgeVariants}
          >
            <Bell className="size-[1.1rem] text-green-600" strokeWidth={2.5} />
            <span className="text-[0.9625rem] font-bold text-gray-700">na hora</span>
          </motion.div>

          <PhoneFrame>
            <motion.div
              className="flex h-[14.3rem] items-center justify-center rounded-2xl bg-linear-to-b from-primary-50 to-white px-[1.1rem] sm:h-[15.4rem]"
              initial="idle"
              animate={contentPhase}
              variants={introSequence}
            >
              <div className="flex flex-col items-center gap-3 text-center">
                <motion.div variants={popItem}>
                  <BrandName
                    size="sm"
                    logoClassName="size-[1.65rem]"
                    textClassName="text-[0.9625rem] font-bold text-gray-500"
                  />
                </motion.div>
                <motion.p
                  className="text-[1.1rem] font-extrabold lowercase text-gray-800 sm:text-[1.2375rem]"
                  variants={popItem}
                >
                  acolhimento · senha 013
                </motion.p>
                <motion.div className="flex items-center justify-center gap-1.5" variants={popItem}>
                  <motion.span
                    className="inline-flex origin-top"
                    initial="intro"
                    animate={bellPhase}
                    variants={bellRingVariant}
                  >
                    <Bell className="size-[1.1rem] text-primary" strokeWidth={2.5} />
                  </motion.span>
                  <p className="text-[0.9625rem] font-bold text-gray-500">aguardando sua vez...</p>
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
              <Bell className="size-[0.9625rem] shrink-0 text-white" strokeWidth={3} />
              <p className="text-[0.9625rem] font-extrabold text-white">sua vez no acolhimento!</p>
            </div>
          </motion.div>
        </motion.div>
      </IllustrationScene>
    </IllustrationStage>
  );
}
