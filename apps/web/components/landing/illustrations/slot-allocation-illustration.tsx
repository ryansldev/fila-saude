"use client";

import { CalendarDays, Lock, UserCheck } from "lucide-react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { useRef } from "react";

import {
  badgeVariants,
  ctaVariants,
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
  primaryCtaBarClasses,
} from "../illustration-stage";

const suggestions = [
  { name: "Carlos Melo", reasons: ["urgente sugerido", "espera há 3 dias"], tone: "red" },
  { name: "Dora Alves", reasons: ["idosa, 82 anos", "espera há 41 dias"], tone: "gray" },
  { name: "Rita Gomes", reasons: ["idosa, 66 anos", "espera há 25 dias"], tone: "gray" },
] as const;

const toneClasses = {
  red: "bg-red-500",
  orange: "bg-orange-500",
  gray: "bg-gray-300",
} as const;

const PHASE_DURATIONS = {
  intro: 700,
  select: 300,
  result: 500,
} as const;

export function SlotAllocationIllustration() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, inViewViewportLoop);
  const prefersReducedMotion = useReducedMotion();
  const { contentPhase, levitating } = useStandardPhaseLoop(isInView, !!prefersReducedMotion, PHASE_DURATIONS);

  return (
    <IllustrationStage tone="primary">
      <IllustrationScene>
        <motion.div ref={ref} className="relative" animate={levitating ? illustrationLevitate : illustrationRest}>
          <motion.div
            className={cn(floatingBadgeClasses("left"), "inline-flex")}
            initial="idle"
            animate={contentPhase}
            variants={badgeVariants}
          >
            <UserCheck className="size-[1.1rem] text-primary" strokeWidth={2.5} />
            <span className="text-[0.9625rem] font-bold text-gray-700">o agendador decide</span>
          </motion.div>

          <PhoneFrame>
            <motion.div
              className="space-y-3 px-1 pb-2 pt-1"
              initial="idle"
              animate={contentPhase}
              variants={introSequence}
            >
              <motion.div className="flex items-center gap-2.5" variants={popItem}>
                <span className="flex size-[2.475rem] shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary">
                  <CalendarDays className="size-[1.1rem]" strokeWidth={2.5} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[1.1rem] font-bold text-gray-800">sugestão para segunda</p>
                  <p className="flex items-center gap-1 truncate text-[0.9625rem] font-bold text-primary">
                    <Lock className="size-[0.9625rem] shrink-0" strokeWidth={2.5} aria-label="privada" />
                    odontologia · 3 vagas
                  </p>
                </div>
              </motion.div>

              <motion.div className="space-y-1.5" variants={listSequence}>
                {suggestions.map((row) => (
                  <motion.div
                    key={row.name}
                    className="flex items-center gap-2.5 rounded-xl border border-b-2 border-gray-100 bg-white px-3 py-2.5 shadow-sm"
                    variants={popItem}
                  >
                    <span className={cn("size-[0.6875rem] shrink-0 rounded-full", toneClasses[row.tone])} />
                    <div className="min-w-0">
                      <p className="truncate text-[0.9625rem] font-extrabold text-gray-800">{row.name}</p>
                      <p className="truncate text-[0.875rem] font-bold text-gray-500">{row.reasons.join(" · ")}</p>
                    </div>
                  </motion.div>
                ))}
              </motion.div>

              <motion.p className="text-center text-[0.9625rem] text-gray-500" variants={popItem}>
                o sistema sugere e explica o motivo
              </motion.p>

              <motion.div className={primaryCtaBarClasses} variants={ctaVariants}>
                aprovar vagas
              </motion.div>
            </motion.div>
          </PhoneFrame>
        </motion.div>
      </IllustrationScene>
    </IllustrationStage>
  );
}
