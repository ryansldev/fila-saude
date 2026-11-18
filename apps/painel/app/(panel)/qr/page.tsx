"use client";

import type { UnitQr } from "@fila-saude/schemas/queue";
import { MonitorIcon } from "lucide-react";
import { Notice } from "@/components/form";
import { PageHeader } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Bubble, DrLino } from "@/components/ui/dr-lino";
import { EntryQr } from "@/components/ui/entry-qr";
import { useCurrentUnit } from "@/lib/current-unit";
import { qrVisible } from "@/lib/qr";
import { useQuery } from "@/lib/use-query";

const STEPS = [
  {
    title: "Deixe o código à vista de quem chega",
    text: 'Na TV da sala de espera ou num monitor virado para o balcão ("Abrir para o paciente").',
  },
  {
    title: "A pessoa lê com o celular",
    text: 'E passa de "a caminho" para "na unidade" na Fila do dia. Você não precisa fazer nada.',
  },
  { title: "O código troca a cada 30 s", text: "Assim ninguém entra na fila de casa com uma foto dele." },
] as const;

/**
 * QR de entrada, a tela da equipe (RN-PRES-01): o código para conferir, as sessões abertas e o
 * Dr. Lino explicando a quem atende como o QR funciona. O paciente vê a versão em tela cheia.
 */
export default function StaffEntryQr() {
  const { current, error: unitError } = useCurrentUnit(["verify_and_mark_attendance", "open_cancel_close_session"]);
  const qr = useQuery<UnitQr>(current ? `/v1/panel/units/${current}/qr` : null, 5_000);
  const valid = qrVisible(qr.detail, qr.error);

  return (
    <div className="flex w-full flex-col gap-5">
      <PageHeader
        title="QR de entrada"
        description="Quem já se inscreveu entra na fila de hoje lendo este código ao chegar."
        actions={
          <Button icon={MonitorIcon} onClick={() => window.open("/qr-paciente", "_blank", "noopener")}>
            Abrir para o paciente (tela cheia)
          </Button>
        }
      />
      <Notice text={unitError ?? qr.error} />
      {qr.detail && qr.detail.sessions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {qr.detail.sessions.map((s) => (
            <span
              key={s.id}
              className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--ds-line)] bg-white px-3 py-1 text-sm font-bold"
            >
              <span className="size-2 rounded-full bg-green-600" aria-hidden />
              {s.service}
            </span>
          ))}
        </div>
      ) : null}
      <div className="grid items-start gap-4 lg:grid-cols-[260px_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
          {valid && qr.detail?.content ? (
            <>
              <EntryQr
                content={qr.detail.content}
                expiresAt={qr.detail.expiresAt}
                serverNow={qr.detail.now}
                intervalSeconds={qr.detail.intervalSeconds}
              />
              <p className="mt-2 text-xs text-slate-500">troca sozinho a cada {qr.detail.intervalSeconds} s</p>
            </>
          ) : (
            <p className="px-2 py-10 text-sm text-slate-600">O código aparece quando uma sessão abrir.</p>
          )}
        </section>
        <section className="grid grid-cols-[76px_1fr] items-start gap-4 rounded-2xl border border-slate-200 bg-white p-4">
          <DrLino />
          <div className="flex flex-col gap-4">
            <Bubble className="text-[15px]">Oi! Eu explico como o QR funciona na sua unidade.</Bubble>
            <ol className="flex flex-col gap-3">
              {STEPS.map((p, i) => (
                <li key={p.title} className="grid grid-cols-[28px_1fr] gap-3 text-sm text-slate-600">
                  <span className="flex size-7 items-center justify-center rounded-full bg-primary-50 font-extrabold text-primary">
                    {i + 1}
                  </span>
                  <span>
                    <strong className="block text-slate-900">{p.title}</strong>
                    {p.text}
                  </span>
                </li>
              ))}
              <li className="grid grid-cols-[28px_1fr] gap-3 text-sm text-slate-600">
                <span className="flex size-7 items-center justify-center rounded-full bg-amber-50 font-extrabold text-amber-800">
                  !
                </span>
                <span>
                  <strong className="block text-slate-900">Não deu certo?</strong>
                  Sem celular, câmera que não lê ou "passe na recepção": confira o documento e marque a presença na Fila
                  do dia.
                </span>
              </li>
            </ol>
          </div>
        </section>
      </div>
    </div>
  );
}
