"use client";

import { Check, Hand } from "lucide-react";
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

const options = [
  { id: "novo", label: "problema novo ou que piorou", selected: true },
  { id: "acompanhamento", label: "acompanhamento de doença", selected: false },
  { id: "rotina", label: "exame, check-up ou rotina", selected: false },
] as const;

const PHASE_DURATIONS = {
  intro: 520,
  select: 260,
  result: 500,
} as const;

export function QuestionnaireIllustration() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, inViewViewportLoop);
  const prefersReducedMotion = useReducedMotion();
  const { contentPhase, levitating } = useStandardPhaseLoop(isInView, !!prefersReducedMotion, PHASE_DURATIONS);

  const answered = contentPhase === "select" || contentPhase === "result" || contentPhase === "static";

  return (
    <IllustrationStage tone="green">
      <IllustrationScene>
        <motion.div ref={ref} className="relative" animate={levitating ? illustrationLevitate : illustrationRest}>
          <motion.div
            className={cn(floatingBadgeClasses("right"), "inline-flex")}
            initial="idle"
            animate={contentPhase}
            variants={badgeVariants}
          >
            <Hand className="size-[1.1rem] text-primary" strokeWidth={2.5} />
            <span className="text-[0.9625rem] font-bold text-gray-700">só toques</span>
          </motion.div>

          <PhoneFrame>
            <motion.div
              className="space-y-3 px-1 pb-2 pt-1"
              initial="idle"
              animate={contentPhase}
              variants={introSequence}
            >
              <motion.div className="space-y-1.5" variants={popItem}>
                <div className="flex items-center justify-between text-[0.9625rem] font-bold lowercase tracking-wide text-gray-500">
                  <span>clínico geral</span>
                  <span className="tabular-nums">2 de 5</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full w-2/5 rounded-full bg-primary" />
                </div>
              </motion.div>

              <motion.p
                className="text-[1.2375rem] font-extrabold lowercase leading-tight text-gray-900"
                variants={popItem}
              >
                por que você quer o atendimento?
              </motion.p>

              <motion.div className="space-y-2" variants={listSequence}>
                {options.map((option) => {
                  const active = option.selected && answered;
                  return (
                    <motion.div
                      key={option.id}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-2xl border-2 border-b-4 px-3 py-2.5 text-[0.9625rem] font-extrabold lowercase transition-colors",
                        active
                          ? "border-primary-300 bg-primary-50 text-primary-800"
                          : "border-gray-100 bg-white text-gray-700",
                      )}
                      variants={popItem}
                    >
                      {option.label}
                      {active ? <Check className="size-[1.1rem] shrink-0 text-primary" strokeWidth={3} /> : null}
                    </motion.div>
                  );
                })}
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
