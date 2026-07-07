import { ArrowUp, Clock, Users } from "lucide-react";

import {
  FloatingBadge,
  IllustrationScene,
  IllustrationStage,
  PhoneFrame,
  PhoneQueueHeader,
} from "../illustration-stage";

export function QueuePositionIllustration() {
  return (
    <IllustrationStage tone="yellow">
      <IllustrationScene className="pb-20 sm:pb-[5.5rem]">
        <FloatingBadge>
          <span className="size-2.5 animate-pulse rounded-full bg-green-500" />
          <span className="text-sm font-bold text-gray-700">ao vivo</span>
        </FloatingBadge>

        <PhoneFrame>
          <div className="space-y-3 px-1 pb-2 pt-1">
            <PhoneQueueHeader ticket="013" />

            <div className="rounded-2xl border border-b-4 border-primary-200 bg-primary-50 px-4 py-5 text-center">
              <p className="text-sm font-bold lowercase tracking-wide text-primary-700">sua posição</p>
              <p className="mt-1 text-6xl font-extrabold leading-none text-primary sm:text-8xl lg:text-9xl">4º</p>
              <p className="mt-2 text-sm font-bold lowercase tracking-wide text-gray-500">no acolhimento</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm font-bold text-gray-500">
                <span>3 na frente</span>
                <span>9 atrás</span>
              </div>
              <div className="relative h-3 overflow-hidden rounded-full bg-gray-100">
                <div className="absolute inset-y-0 left-0 w-[28%] rounded-full bg-primary" />
                <div className="absolute top-1/2 left-[28%] size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary shadow-sm" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-b-2 border-gray-100 bg-white px-2.5 py-2.5 text-center shadow-sm">
                <Users className="mx-auto size-5 text-primary" strokeWidth={2.5} />
                <p className="mt-1 text-xl font-extrabold text-gray-900">3</p>
                <p className="text-sm font-bold text-gray-500">na frente</p>
              </div>
              <div className="rounded-2xl border border-b-2 border-gray-100 bg-white px-2.5 py-2.5 text-center shadow-sm">
                <Clock className="mx-auto size-5 text-primary" strokeWidth={2.5} />
                <p className="mt-1 text-xl font-extrabold text-gray-900">~18</p>
                <p className="text-sm font-bold text-gray-500">min</p>
              </div>
            </div>
          </div>
        </PhoneFrame>

        <div className="absolute inset-x-0 bottom-0 rounded-2xl border border-b-4 border-primary-700 bg-primary px-3 py-2.5 shadow-[0_16px_32px_-10px_rgba(97,124,196,0.55)] sm:px-4 sm:py-3 lg:-bottom-2 lg:-left-3 lg:w-[calc(100%+0.75rem)]">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/20 text-white sm:size-10">
              <ArrowUp className="size-4 sm:size-5" strokeWidth={2.5} />
            </span>
            <div className="min-w-0 text-white">
              <p className="text-sm font-extrabold sm:text-base">você avançou! agora é o 4º</p>
              <p className="text-sm text-primary-50">atualizado agora</p>
            </div>
          </div>
        </div>
      </IllustrationScene>
    </IllustrationStage>
  );
}
