import { Building2, Check, Lock, Siren, UserCheck, Users } from "lucide-react";

import { IllustrationScene, IllustrationStage, PhoneFrame } from "../illustration-stage";

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

export function NearbyClinicsIllustration() {
  return (
    <IllustrationStage tone="primary">
      <IllustrationScene className="pb-20 sm:pb-[5.5rem]">
        <div className="absolute top-0 right-0 z-10 flex max-w-[calc(100%-0.5rem)] items-center gap-2 rounded-full border border-b-[3px] border-gray-100 bg-white px-3 py-1.5 shadow-md sm:px-4 sm:py-2">
          <UserCheck className="size-4 text-primary" strokeWidth={2.5} />
          <span className="text-sm font-bold text-gray-700">sua UBS</span>
        </div>

        <PhoneFrame>
          <div className="space-y-3 px-0.5 pb-1 pt-0.5">
            <p className="text-sm font-bold lowercase tracking-wide text-gray-500">pra onde ir?</p>

            <div className="flex gap-1 rounded-xl bg-gray-100 p-0.5">
              <div className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border-b-[3px] border-primary-700 bg-primary py-2 text-white shadow-sm">
                <Check className="size-3.5" strokeWidth={3} />
                <span className="text-sm font-extrabold">UBS</span>
              </div>
              <div className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2">
                <Siren className="size-3.5 text-gray-400" strokeWidth={2.5} />
                <span className="text-sm font-extrabold text-gray-500">UPA</span>
              </div>
            </div>

            <p className="text-center text-sm text-gray-500">consulta · sintomas leves</p>

            <div className="overflow-hidden rounded-2xl border-2 border-primary bg-white shadow-sm">
              <div className="flex items-start gap-2.5 border-b border-primary-100 bg-primary-50 px-3 py-2.5">
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
              </div>

              <div className="space-y-1.5 px-2.5 py-2">
                <p className="text-sm font-bold lowercase tracking-wide text-gray-400">atendimentos de hoje</p>

                {todayServices.map((service) =>
                  service.public ? (
                    <div
                      key={service.id}
                      className="rounded-xl border-2 border-primary bg-primary-50 px-2.5 py-2"
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
                    </div>
                  ) : (
                    <div
                      key={service.id}
                      className="flex items-center gap-2 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-2.5 py-2"
                    >
                      <Lock className="size-3.5 shrink-0 text-gray-400" strokeWidth={2.5} />
                      <p className="min-w-0 flex-1 truncate text-sm font-bold text-gray-600">{service.name}</p>
                      <span className="shrink-0 rounded-full bg-gray-200 px-2 py-0.5 text-sm font-bold lowercase text-gray-600">
                        {service.status}
                      </span>
                    </div>
                  ),
                )}

                <div className="rounded-xl border border-b-[3px] border-primary-700 bg-primary py-2.5 text-center text-sm font-extrabold uppercase tracking-wide text-white shadow-sm">
                  entrar no acolhimento
                </div>
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-sm font-bold lowercase tracking-wide text-gray-400">outras UBS</p>
              <div className="space-y-1">
                {otherUnits.map((unit) => (
                  <div
                    key={unit.id}
                    className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-b-2 border-gray-100 bg-white px-2.5 py-2 shadow-sm"
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                      <Building2 className="size-3.5" strokeWidth={2.5} />
                    </span>
                    <p className="min-w-0 flex-1 truncate text-sm font-extrabold text-gray-800">{unit.name}</p>
                    <span className="shrink-0 text-sm tabular-nums text-gray-500">{unit.distance}</span>
                    <span className="shrink-0 rounded-lg border border-b-2 border-gray-200 bg-gray-50 px-2 py-1 text-sm font-extrabold lowercase text-gray-700">
                      cadastrar
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-1.5 text-center text-sm leading-snug text-gray-400">
                quer trocar? você sai da cadastrada.
              </p>
            </div>
          </div>
        </PhoneFrame>

        <div className="absolute inset-x-0 bottom-0 rounded-2xl border border-b-4 border-green-700 bg-green-500 px-3 py-2.5 shadow-[0_16px_32px_-10px_rgba(34,197,94,0.55)] sm:px-4 sm:py-3">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/20 text-white">
              <Check className="size-4" strokeWidth={3} />
            </span>
            <div className="min-w-0 text-white">
              <p className="text-sm font-extrabold sm:text-base">você entrou na fila!</p>
              <p className="truncate text-sm text-green-50">
                acolhimento · senha <span className="font-mono font-extrabold">013</span>
              </p>
            </div>
          </div>
        </div>
      </IllustrationScene>
    </IllustrationStage>
  );
}
