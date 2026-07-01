import { ArrowRight } from "lucide-react";
import { Fragment } from "react";

const steps = [
  {
    label: "Entra na fila",
    visual: (
      <div className="mx-auto w-[7.5rem] rounded-xl border border-gray-200 bg-white p-2 shadow-sm">
        <div className="rounded-md bg-gray-100 px-2 py-1 text-center text-[10px] font-medium text-gray-600">
          UBS Centro
        </div>
        <div className="mt-2 rounded-md border border-b-2 border-primary-700 bg-primary px-2 py-1.5 text-center text-[10px] font-bold text-white">
          Entrar na fila
        </div>
      </div>
    ),
  },
  {
    label: "Acompanha a posição",
    visual: (
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-gray-200" />
          <span className="size-2 rounded-full bg-gray-200" />
          <span className="size-2 rounded-full bg-gray-200" />
          <span className="size-3 rounded-full border-2 border-primary bg-primary-100" />
          <span className="size-2 rounded-full bg-gray-200" />
        </div>
        <span className="text-2xl font-bold text-primary">4º</span>
      </div>
    ),
  },
  {
    label: "Vai na hora certa",
    visual: (
      <div className="mx-auto w-[9.5rem] rounded-lg border border-b-2 border-gray-200 bg-white p-2.5 shadow-sm">
        <div className="flex items-start gap-2">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm">
            🔔
          </span>
          <div className="space-y-0.5">
            <p className="text-[10px] font-bold text-gray-800">Sua vez chegou!</p>
            <p className="text-[9px] leading-tight text-gray-500">Pode ir ao posto agora</p>
          </div>
        </div>
      </div>
    ),
  },
] as const;

export function HowItWorks() {
  return (
    <section id="como-funciona" aria-labelledby="como-funciona-titulo" className="w-full max-w-2xl scroll-mt-8">
      <h2 id="como-funciona-titulo" className="sr-only">
        Como funciona
      </h2>

      <ol className="flex flex-col items-center gap-3 sm:flex-row sm:items-stretch sm:gap-2">
        {steps.map((step, index) => (
          <Fragment key={step.label}>
            <li className="w-full flex-1">
              <div className="flex min-h-36 flex-col items-center justify-between rounded-xl border border-b-4 border-gray-100 bg-gray-50 px-4 py-5 sm:min-h-44">
                <div className="flex flex-1 items-center justify-center">{step.visual}</div>
                <p className="mt-4 text-center text-sm font-semibold text-gray-800">{step.label}</p>
              </div>
            </li>

            {index < steps.length - 1 ? (
              <li aria-hidden className="flex list-none items-center justify-center py-1 sm:py-0">
                <ArrowRight className="size-5 shrink-0 rotate-90 text-gray-300 sm:rotate-0" />
              </li>
            ) : null}
          </Fragment>
        ))}
      </ol>
    </section>
  );
}
