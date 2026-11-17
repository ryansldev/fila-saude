"use client";

import type { UnitQr } from "@fila-saude/schemas/queue";
import type { TodaySummary } from "@fila-saude/schemas/unit";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Logo } from "@/components/logo";
import { Bubble, DrLino } from "@/components/ui/dr-lino";
import { EntryQr } from "@/components/ui/entry-qr";
import { useCurrentUnit } from "@/lib/current-unit";
import { qrVisible, speechWithoutSession } from "@/lib/qr";
import { useMe } from "@/lib/session";
import { useQuery } from "@/lib/use-query";

const STEPS = ["abra a câmera do celular", "aponte para o código ao lado", "pronto! fique de olho na TV"];

/**
 * QR de entrada, a tela do paciente (tela cheia, no monitor do balcão): o código grande, o Dr. Lino
 * falando com quem chega e os 3 passos. Aberta pela equipe, com a sessão dela; fundo sempre branco.
 */
export default function PatientQr() {
  const router = useRouter();
  const me = useMe();
  useEffect(() => {
    if (me.state === "anonymous") router.replace("/login");
  }, [me.state, router]);
  const { current, unit } = useCurrentUnit(["verify_and_mark_attendance", "open_cancel_close_session"]);
  const qr = useQuery<UnitQr>(current ? `/v1/panel/units/${current}/qr` : null, 5_000);
  const today = useQuery<TodaySummary[]>(current ? "/v1/panel/units/today" : null, 60_000);
  const valid = qrVisible(qr.detail, qr.error);
  const next = today.detail?.find((h) => h.unitId === current)?.nextOpening ?? null;
  const speech = valid
    ? "chegou? que bom! leia o código com a câmera do celular."
    : speechWithoutSession(next, unit?.timeZone ?? "America/Sao_Paulo");

  return (
    <main className="relative flex min-h-screen flex-col bg-white px-[5vw] pt-[2.4vw] pb-[4vw] text-[#111313]">
      <header className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-[1.25vw] font-black text-[#0c2e4e]">
          <Logo className="size-[1.6vw] text-primary" />
          fila saúde
        </span>
        {unit ? (
          <span className="text-right text-[1.02vw] font-extrabold text-[#0c2e4e]">
            {unit.name}
            {unit.address ? (
              <span className="block text-[0.8em] font-semibold text-slate-500">
                {unit.address.street}, {unit.address.number} — {unit.address.neighborhood}
              </span>
            ) : null}
          </span>
        ) : null}
      </header>
      <div className="grid flex-1 grid-cols-[30%_1fr] items-center gap-x-[4%] pt-[4vw]">
        <div>
          {valid && qr.detail?.content ? (
            <EntryQr
              content={qr.detail.content}
              expiresAt={qr.detail.expiresAt}
              intervalSeconds={qr.detail.intervalSeconds}
            />
          ) : null}
        </div>
        <div className="grid grid-cols-[27%_1fr] items-center gap-x-[4%]">
          <DrLino />
          <div className="flex flex-col gap-[1.5vw]">
            <Bubble className="text-[1.5vw] leading-tight">{speech}</Bubble>
            {valid ? (
              <>
                <ol className="flex flex-col gap-[1.1vw]">
                  {STEPS.map((p, i) => (
                    <li key={p} className="flex items-center gap-[0.7vw] text-[1.2vw] font-bold text-[#1f2d36]">
                      <span className="flex size-[1.8vw] shrink-0 items-center justify-center rounded-full border-b-[3px] border-[var(--ds-action-shadow)] bg-[var(--ds-action)] text-[0.85em] font-black text-white">
                        {i + 1}
                      </span>
                      {p}
                    </li>
                  ))}
                </ol>
                <div className="flex flex-wrap gap-2">
                  {qr.detail?.sessions.map((s) => (
                    <span
                      key={s.id}
                      className="rounded-full bg-[#eaf5f9] px-[1vw] py-[0.2vw] text-[0.95vw] font-extrabold text-[#185b9a]"
                    >
                      {s.service.toLowerCase()}
                    </span>
                  ))}
                </div>
              </>
            ) : null}
            <p className="rounded-[1vw] bg-[#fffae8] px-[1.4vw] py-[0.9vw] text-[1vw] font-bold text-[#66520a]">
              sem celular ou não deu certo? fale com a recepção.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
