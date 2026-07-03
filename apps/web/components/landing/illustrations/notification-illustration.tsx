import { Bell } from "lucide-react";

import { BrandName } from "@/components/landing/brand-name";

import { IllustrationScene, IllustrationStage, PhoneFrame } from "../illustration-stage";

export function NotificationIllustration() {
  return (
    <IllustrationStage tone="green">
      <IllustrationScene className="pb-24 sm:pb-28">
        <PhoneFrame>
          <div className="flex h-52 items-center justify-center rounded-2xl bg-linear-to-b from-primary-50 to-white px-4 sm:h-56">
            <div className="flex flex-col items-center gap-3 text-center">
              <BrandName size="sm" logoClassName="size-6" textClassName="text-sm font-bold text-gray-500" />
              <p className="text-base font-extrabold lowercase text-gray-800 sm:text-lg">acolhimento · senha 013</p>
              <p className="text-sm font-bold text-gray-500">aguardando sua vez...</p>
            </div>
          </div>
        </PhoneFrame>

        <div className="absolute inset-x-0 bottom-0 rounded-2xl border border-b-4 border-green-700 bg-green-500 p-3 shadow-[0_16px_32px_-10px_rgba(34,197,94,0.55)] sm:p-4 lg:-right-2 lg:left-4">
          <div className="flex items-start gap-2.5 sm:gap-3.5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/20 text-white sm:size-12">
              <Bell className="size-5 sm:size-6" strokeWidth={2.5} />
            </span>
            <div className="min-w-0 text-white">
              <p className="text-sm font-extrabold sm:text-base">sua vez no acolhimento!</p>
              <p className="mt-1 text-sm leading-snug text-green-50">UBS Centro · vai agora</p>
            </div>
          </div>
        </div>
      </IllustrationScene>
    </IllustrationStage>
  );
}
