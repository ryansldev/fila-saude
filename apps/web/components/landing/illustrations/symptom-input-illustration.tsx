import { Stethoscope } from "lucide-react";

import { IllustrationScene, IllustrationStage, PhoneFrame } from "../illustration-stage";

const needOptions = [
  { id: "consulta", label: "consulta", selected: true },
  { id: "exame", label: "exame", selected: false },
  { id: "vacina", label: "vacina", selected: false },
] as const;

const symptomTags = ["febre", "dor de cabeça", "mal-estar"] as const;

export function SymptomInputIllustration() {
  return (
    <IllustrationStage tone="green">
      <IllustrationScene>
        <PhoneFrame>
          <div className="space-y-3 px-1 pb-2 pt-1">
            <p className="text-sm font-bold lowercase tracking-wide text-gray-500">do que você precisa?</p>

            <div className="flex flex-wrap gap-1.5">
              {needOptions.map((option) => (
                <span
                  key={option.id}
                  className={
                    option.selected
                      ? "rounded-full border-b-[3px] border-primary-700 bg-primary px-2.5 py-1.5 text-sm font-extrabold lowercase text-white shadow-sm"
                      : "rounded-full border border-b-2 border-gray-200 bg-white px-2.5 py-1.5 text-sm font-bold lowercase text-gray-600"
                  }
                >
                  {option.label}
                </span>
              ))}
            </div>

            <p className="text-sm font-bold lowercase tracking-wide text-gray-500">conta o motivo</p>

            <div className="space-y-2 rounded-2xl border border-b-2 border-gray-100 bg-white p-2.5 shadow-sm">
              <div className="min-h-[4.5rem] rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                <p className="text-sm leading-relaxed text-gray-600">
                  febre desde ontem, dor de cabeça e mal-estar
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {symptomTags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-primary-200 bg-primary-50 px-2.5 py-1 text-sm font-bold lowercase text-primary-800"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-b-4 border-primary-700 bg-primary py-3.5 text-center text-base font-extrabold uppercase tracking-wide text-white shadow-sm">
              continuar
            </div>
          </div>
        </PhoneFrame>

        <div className="absolute top-0 right-0 z-10 flex max-w-[calc(100%-0.5rem)] items-center gap-2 rounded-full border border-b-[3px] border-gray-100 bg-white px-3 py-1.5 shadow-md sm:px-4 sm:py-2">
          <Stethoscope className="size-4 text-primary" strokeWidth={2.5} />
          <span className="text-sm font-bold text-gray-700">primeiro passo</span>
        </div>
      </IllustrationScene>
    </IllustrationStage>
  );
}
