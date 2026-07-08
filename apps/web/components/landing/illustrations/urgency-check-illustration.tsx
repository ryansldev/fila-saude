"use client";

import { AlertTriangle, Check } from "lucide-react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { useRef } from "react";

import {
  badgeVariants,
  checkPopVariant,
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

const urgentSigns = [
  { id: "ar", label: "falta de ar forte" },
  { id: "peito", label: "dor forte no peito" },
  { id: "desmaio", label: "desmaio ou confusão" },
  { id: "sangue", label: "sangramento que não para" },
  { id: "convulsao", label: "convulsão" },
] as const;

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
        <motion.div ref={ref} className="relative" animate={levitating ? illustrationLevitate : illustrationRest}>
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
                  variants={popItem}
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
                      variants={checkPopVariant}
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
