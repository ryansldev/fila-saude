import { ChevronLeft, Info, MapPin } from "lucide-react";

import { IllustrationScene, IllustrationStage, PhoneFrame } from "../illustration-stage";

const aheadRows = [
  { position: 1, ticket: "004", reason: "idoso", preferential: true },
  { position: 2, ticket: "011", reason: "gestante", preferential: true },
  { position: 3, ticket: "012", reason: "chegou antes", preferential: false },
] as const;

const userTicket = "013";

export function QueueTransparencyIllustration() {
  return (
    <IllustrationStage tone="primary">
      <IllustrationScene className="pb-20 pt-9 sm:pb-[5.5rem] sm:pt-8">
        <div className="absolute top-0 left-0 z-10 flex max-w-[calc(100%-0.5rem)] items-center gap-2 rounded-full border border-b-[3px] border-gray-100 bg-white px-3 py-1.5 shadow-md sm:px-4 sm:py-2">
          <Info className="size-4 text-primary" strokeWidth={2.5} />
          <span className="text-sm font-bold text-gray-700">tudo claro</span>
        </div>

        <PhoneFrame>
          <div className="space-y-3 px-1 pb-2 pt-1">
            <button
              type="button"
              className="flex items-center gap-1 text-sm font-extrabold lowercase text-primary"
            >
              <ChevronLeft className="size-4" strokeWidth={2.5} />
              sua posição
            </button>

            <div className="flex items-center gap-2.5 rounded-2xl border border-b-2 border-gray-100 bg-white px-3 py-2.5 shadow-sm">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary">
                <MapPin className="size-4" strokeWidth={2.5} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-bold text-gray-800">UBS Centro</p>
                <p className="truncate text-sm font-bold text-primary">acolhimento</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-bold text-gray-500">senha</p>
                <p className="font-mono text-base font-extrabold tabular-nums text-primary">{userTicket}</p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm font-bold lowercase tracking-wide text-gray-500">na sua frente</p>
              <span className="rounded-full bg-primary-50 px-2.5 py-0.5 text-sm font-extrabold tabular-nums text-primary">
                3
              </span>
            </div>

            <div className="space-y-1.5">
              {aheadRows.map((row) => (
                <div
                  key={row.ticket}
                  className="flex items-center gap-2.5 rounded-xl border border-b-2 border-gray-100 bg-white px-3 py-2.5 shadow-sm"
                >
                  <span
                    className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-white ${
                      row.preferential ? "bg-orange-500" : "bg-gray-300"
                    }`}
                  >
                    {row.position}º
                  </span>
                  <p className="font-mono text-sm font-extrabold tabular-nums text-gray-800">senha {row.ticket}</p>
                  <span
                    className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-xs font-bold lowercase sm:px-2.5 sm:text-sm ${
                      row.preferential ? "bg-orange-100 text-orange-800" : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {row.reason}
                  </span>
                </div>
              ))}

              <div className="rounded-xl border-2 border-primary bg-primary-50 px-3 py-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-extrabold text-white">
                    4º
                  </span>
                  <p className="font-mono text-sm font-extrabold tabular-nums text-primary-900">senha {userTicket}</p>
                  <span className="text-sm font-extrabold text-primary-800">você</span>
                  <span className="ml-auto rounded-full bg-white px-2.5 py-0.5 text-sm font-bold lowercase text-primary-700">
                    consulta
                  </span>
                </div>
              </div>
            </div>

            <p className="text-center text-sm text-gray-500">preferência legal primeiro, depois ordem de senha</p>
          </div>
        </PhoneFrame>

        <div className="absolute inset-x-0 bottom-0 rounded-2xl border border-b-4 border-primary-200 bg-white px-3.5 py-2.5 shadow-[0_16px_32px_-10px_rgba(97,124,196,0.35)] sm:px-4 sm:py-3">
          <div className="flex items-start gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary">
              <Info className="size-4" strokeWidth={2.5} />
            </span>
            <div>
              <p className="text-sm font-extrabold text-gray-900">agora faz sentido!</p>
              <p className="mt-0.5 text-sm leading-snug text-gray-600">2 preferenciais e 1 pessoa na frente</p>
            </div>
          </div>
        </div>
      </IllustrationScene>
    </IllustrationStage>
  );
}
