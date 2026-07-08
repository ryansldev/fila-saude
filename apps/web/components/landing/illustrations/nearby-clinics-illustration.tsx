"use client";

import { Building2, Check, Lock, Siren, UserCheck, Users } from "lucide-react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { useRef } from "react";

import {
  badgeVariants,
  footerVariants,
  illustrationLevitate,
  illustrationRest,
  introSequence,
  inViewViewportLoop,
  listSequence,
  popItem,
  pressScaleVariant,
} from "@/lib/motion";
import { useStandardPhaseLoop } from "@/lib/use-standard-phase-loop";
import { cn } from "@/lib/utils";

import { floatingBadgeClasses, IllustrationScene, IllustrationStage, PhoneFrame } from "../illustration-stage";

const todayServices = [
  {
    id: "acolhimento",
    name: "acolhimento",
    status: "fila aberta",
    queueCount: 12,
    public: true,
  },
  {
    id: "mamografia",
    name: "mamografia",
    status: "só agendados",
    public: false,
  },
] as const;

const otherUnits = [
  { id: "norte", name: "UBS Norte", distance: "2,1 km" },
  { id: "jardim", name: "UBS Jardim", distance: "3,4 km" },
] as const;

const PHASE_DURATIONS = {
  intro: 750,
  select: 320,
  result: 520,
} as const;

export function NearbyClinicsIllustration() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, inViewViewportLoop);
  const prefersReducedMotion = useReducedMotion();
  const { contentPhase, levitating } = useStandardPhaseLoop(isInView, !!prefersReducedMotion, PHASE_DURATIONS);

  const ctaPhase =
    contentPhase === "idle" || contentPhase === "intro" ? "intro" : contentPhase === "select" ? "select" : "result";

  return (
    <IllustrationStage tone="primary">
      <IllustrationScene className="pb-20 sm:pb-24">
        <motion.div ref={ref} className="relative" animate={levitating ? illustrationLevitate : illustrationRest}>
          <motion.div
            className={cn(floatingBadgeClasses("right"), "inline-flex")}
            initial="idle"
            animate={contentPhase}
            variants={badgeVariants}
          >
            <UserCheck className="size-4 text-primary" strokeWidth={2.5} />
            <span className="text-sm font-bold text-gray-700">sua UBS</span>
          </motion.div>

          <PhoneFrame>
            <motion.div
              className="space-y-3 px-0.5 pb-1 pt-0.5"
              initial="idle"
              animate={contentPhase}
              variants={introSequence}
            >
              <motion.p className="text-sm font-bold lowercase tracking-wide text-gray-500" variants={popItem}>
                pra onde ir?
              </motion.p>

              <motion.div className="flex gap-1 rounded-xl bg-gray-100 p-0.5" variants={popItem}>
                <div className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border-b-[3px] border-primary-700 bg-primary py-2 text-white shadow-sm">
                  <Check className="size-3.5" strokeWidth={3} />
                  <span className="text-sm font-extrabold">UBS</span>
                </div>
                <div className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 opacity-50">
                  <Siren className="size-3.5 text-gray-400" strokeWidth={2.5} />
                  <span className="text-sm font-extrabold text-gray-500">UPA</span>
                </div>
              </motion.div>

              <motion.div
                className="overflow-hidden rounded-2xl border-2 border-primary bg-white shadow-sm"
                variants={listSequence}
              >
                <motion.div
                  className="flex items-start gap-2.5 border-b border-primary-100 bg-primary-50 px-3 py-2.5"
                  variants={popItem}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                    <Building2 className="size-4" strokeWidth={2.5} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-extrabold text-gray-900">UBS Centro</p>
                    <p className="mt-0.5 text-sm text-gray-500">R. das Flores, 120 · 0,8 km</p>
                    <span className="mt-1 inline-flex rounded-full border border-b-2 border-primary-200 bg-white px-2 py-0.5 text-sm font-extrabold lowercase text-primary">
                      cadastrada
                    </span>
                  </div>
                </motion.div>

                <motion.div className="space-y-1.5 px-2.5 py-2" variants={listSequence}>
                  <motion.p className="text-sm font-bold lowercase tracking-wide text-gray-400" variants={popItem}>
                    atendimentos de hoje
                  </motion.p>

                  {todayServices.map((service) =>
                    service.public ? (
                      <motion.div
                        key={service.id}
                        className="rounded-xl border-2 border-primary bg-primary-50 px-2.5 py-2"
                        variants={popItem}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-extrabold text-gray-900">{service.name}</p>
                          <span className="flex shrink-0 items-center gap-1 text-sm font-extrabold tabular-nums text-primary">
                            <Users className="size-3.5" strokeWidth={2.5} />
                            {service.queueCount}
                          </span>
                        </div>
                        <span className="mt-1 inline-flex rounded-full bg-green-100 px-2 py-0.5 text-sm font-bold lowercase text-green-800">
                          {service.status}
                        </span>
                      </motion.div>
                    ) : (
                      <motion.div
                        key={service.id}
                        className="flex items-center gap-2 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-2.5 py-2"
                        variants={popItem}
                      >
                        <Lock className="size-3.5 shrink-0 text-gray-400" strokeWidth={2.5} />
                        <p className="min-w-0 flex-1 truncate text-sm font-bold text-gray-600">{service.name}</p>
                        <span className="shrink-0 rounded-full bg-gray-200 px-2 py-0.5 text-sm font-bold lowercase text-gray-600">
                          {service.status}
                        </span>
                      </motion.div>
                    ),
                  )}

                  <motion.div
                    className="rounded-xl border border-b-[3px] border-primary-700 bg-primary py-2.5 text-center text-sm font-extrabold uppercase tracking-wide text-white shadow-sm"
                    variants={popItem}
                  >
                    <motion.span
                      className="inline-block"
                      initial="intro"
                      animate={ctaPhase}
                      variants={pressScaleVariant}
                    >
                      entrar no acolhimento
                    </motion.span>
                  </motion.div>
                </motion.div>
              </motion.div>

              <motion.div variants={popItem}>
                <p className="mb-1.5 text-sm font-bold lowercase tracking-wide text-gray-400">outras UBS</p>
                <motion.div className="space-y-1" variants={listSequence}>
                  {otherUnits.map((unit) => (
                    <motion.div
                      key={unit.id}
                      className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-b-2 border-gray-100 bg-white px-2.5 py-2 shadow-sm"
                      variants={popItem}
                    >
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                        <Building2 className="size-3.5" strokeWidth={2.5} />
                      </span>
                      <p className="min-w-0 flex-1 truncate text-sm font-extrabold text-gray-800">{unit.name}</p>
                      <span className="shrink-0 text-sm tabular-nums text-gray-500">{unit.distance}</span>
                      <span className="shrink-0 rounded-lg border border-b-2 border-gray-200 bg-gray-50 px-2 py-1 text-sm font-extrabold lowercase text-gray-700">
                        cadastrar
                      </span>
                    </motion.div>
                  ))}
                </motion.div>
                <p className="mt-1.5 text-center text-sm leading-snug text-gray-400">na UPA não precisa de cadastro.</p>
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
              <Check className="size-3.5 shrink-0 text-white" strokeWidth={3} />
              <p className="text-sm font-extrabold text-white">você entrou na fila!</p>
            </div>
          </motion.div>
        </motion.div>
      </IllustrationScene>
    </IllustrationStage>
  );
}
