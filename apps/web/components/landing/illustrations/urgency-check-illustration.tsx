import { AlertTriangle, Check, Siren } from "lucide-react";

import { IllustrationScene, IllustrationStage, PhoneFrame } from "../illustration-stage";

const urgentSigns = [
  { id: "ar", label: "falta de ar forte" },
  { id: "peito", label: "dor forte no peito" },
  { id: "desmaio", label: "desmaio ou confusão" },
  { id: "sangue", label: "sangramento que não para" },
  { id: "convulsao", label: "convulsão" },
] as const;

export function UrgencyCheckIllustration() {
  return (
    <IllustrationStage tone="yellow">
      <IllustrationScene className="pb-24 sm:pb-28">
        <div className="absolute top-0 right-0 z-10 flex max-w-[calc(100%-0.5rem)] items-center gap-2 rounded-full border border-b-[3px] border-gray-100 bg-white px-3 py-1.5 shadow-md sm:px-4 sm:py-2">
          <AlertTriangle className="size-4 text-yellow-600" strokeWidth={2.5} />
          <span className="text-sm font-bold text-gray-700">pré-triagem</span>
        </div>

        <PhoneFrame>
          <div className="space-y-3 px-1 pb-2 pt-1">
            <div>
              <p className="text-lg font-extrabold lowercase leading-tight text-gray-900">
                tem algum sinal urgente?
              </p>
              <p className="mt-1 text-sm text-gray-500">
                marque o que estiver sentindo agora
              </p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-b-2 border-gray-100 bg-white shadow-sm">
              {urgentSigns.map((sign, index) => (
                <div
                  key={sign.id}
                  className={`flex items-center gap-3 px-3 py-3 ${
                    index < urgentSigns.length - 1 ? "border-b border-gray-100" : ""
                  }`}
                >
                  <span className="flex size-5 shrink-0 rounded-md border-2 border-gray-300 bg-white" />
                  <span className="min-w-0 flex-1 text-sm font-bold lowercase text-gray-800">{sign.label}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-b-2 border-gray-100 bg-white px-3 py-3 shadow-sm">
              <span className="flex size-5 shrink-0 rounded-md border-2 border-gray-300 bg-white" />
              <span className="min-w-0 flex-1 text-sm font-bold lowercase text-gray-800">outro</span>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border-2 border-green-500 bg-green-50 px-3 py-3 shadow-sm">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-md border-2 border-green-600 bg-green-500 text-white">
                <Check className="size-3.5" strokeWidth={3} />
              </span>
              <span className="min-w-0 flex-1 text-sm font-extrabold lowercase text-green-900">
                nenhum desses
              </span>
            </div>

            <div className="rounded-2xl border border-b-4 border-primary-700 bg-primary py-3.5 text-center text-base font-extrabold uppercase tracking-wide text-white shadow-sm">
              continuar
            </div>

            <p className="text-center text-sm leading-snug text-gray-400">
              na unidade, o enfermeiro faz a classificação oficial
            </p>
          </div>
        </PhoneFrame>

        <div className="absolute inset-x-0 bottom-0 space-y-1.5">
          <div className="rounded-2xl border border-b-4 border-green-700 bg-green-500 px-3 py-2.5 shadow-[0_16px_32px_-10px_rgba(34,197,94,0.55)] sm:px-4 sm:py-3">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/20 text-white">
                <Check className="size-4" strokeWidth={3} />
              </span>
              <div className="min-w-0 text-white">
                <p className="text-sm font-extrabold sm:text-base">sem sinais urgentes</p>
                <p className="truncate text-sm text-green-50">caminho leve · UBS</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-b-2 border-orange-200 bg-orange-50 px-3 py-2 opacity-90">
            <Siren className="size-4 shrink-0 text-orange-600" strokeWidth={2.5} />
            <p className="min-w-0 text-sm font-bold text-orange-900">
              sinal urgente ou outro → <span className="font-extrabold">UPA</span>
            </p>
          </div>
        </div>
      </IllustrationScene>
    </IllustrationStage>
  );
}
