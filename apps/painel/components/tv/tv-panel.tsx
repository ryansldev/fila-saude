import type { TvState } from "@fila-saude/schemas/tv";
import { ArrowRightIcon, FootprintsIcon, UsersIcon } from "lucide-react";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

type Call = { id: string; ticket: string; destination: string };

const CARD = "rounded-[1.6vw] border-[0.18vw] border-b-[0.45vw] border-[var(--ds-line)] bg-white";
const LABEL = "text-[1.25vw] font-extrabold tracking-[0.12em] text-slate-500 uppercase";

// No fuso da unidade: aparelhos de TV costumam vir em UTC.
const hour = (now: number, timeZone: string) =>
  new Date(now).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone });

/**
 * A tela da TV pareada (RN-TV-02/03/05), branca e azul: topo com a marca, a unidade e a hora; a chamada
 * grande (azul cheio só enquanto anuncia), as últimas chamadas, os serviços e o QR de entrada.
 */
export function TvPanel({
  state,
  current,
  last,
  svg,
  now,
}: {
  state: Extract<TvState, { state: "paired" }>;
  current: Call | null;
  last: Call[];
  svg: string | null;
  now: number;
}) {
  return (
    <div className="flex h-screen flex-col bg-white text-[#0c2e4e]">
      <header className="grid grid-cols-3 items-center px-[2.6vw] pt-[1.8vw]">
        <span className="flex items-center gap-[0.6vw] text-[1.9vw] font-black">
          <Logo className="size-[2.3vw] text-primary" />
          fila saúde
        </span>
        <span className="truncate text-center text-[1.6vw] font-extrabold">{state.unit.name}</span>
        <span className="text-right text-[2.2vw] font-black tabular-nums">{hour(now, state.timeZone)}</span>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-[2fr_1fr] grid-rows-[minmax(0,1.5fr)_minmax(0,1fr)] gap-[1.4vw] px-[2.6vw] pt-[1.4vw] pb-[2.6vw]">
        <section
          aria-label="chamando agora"
          aria-live="assertive"
          className={cn(
            CARD,
            "flex min-w-0 flex-col items-center justify-center gap-[0.8vw] px-[2vw]",
            current && "border-[var(--ds-action)] border-b-[var(--ds-action-shadow)] bg-[var(--ds-action)] text-white",
          )}
        >
          <p className={cn(LABEL, current && "text-[#cfe2f6]")}>chamando agora</p>
          {current ? (
            <>
              <p className="max-w-full truncate text-[11vw] leading-none font-black tracking-wide">{current.ticket}</p>
              <p className="flex max-w-full items-center gap-[1vw] text-[3.6vw] font-black">
                <ArrowRightIcon className="size-[3.4vw] shrink-0" aria-hidden />
                <span className="truncate">{current.destination.toLowerCase()}</span>
              </p>
            </>
          ) : (
            <>
              <p className="text-[3.6vw] font-black">
                {state.careStarted ? "aguarde a sua senha" : "atendimento ainda não começou"}
              </p>
              <p className="text-[1.6vw] font-bold text-slate-500">a senha aparece aqui quando chamarem</p>
            </>
          )}
        </section>
        <section aria-label="últimas chamadas" className={cn(CARD, "min-h-0 overflow-hidden p-[1.6vw]")}>
          <p className={cn(LABEL, "mb-[0.6vw]")}>últimas chamadas</p>
          <ul>
            {last.map((c) => (
              <li
                key={c.id}
                className="flex items-baseline justify-between gap-[1vw] border-[#eef2f3] border-t-[0.12vw] py-[0.9vw] first:border-t-0"
              >
                <span className="text-[2.1vw] font-black">{c.ticket}</span>
                <span className="truncate text-[1.5vw] font-bold text-slate-500">{c.destination.toLowerCase()}</span>
              </li>
            ))}
          </ul>
        </section>
        <ul className="flex min-h-0 flex-col justify-center gap-[1vw] overflow-hidden">
          {state.services.map((s) => (
            <li
              key={s.name}
              aria-label={s.name.toLowerCase()}
              className="flex items-center justify-between gap-[1vw] rounded-[1.2vw] bg-[#f4f7f8] px-[1.4vw] py-[1vw]"
            >
              <span className="truncate text-[1.8vw] font-black">{s.name.toLowerCase()}</span>
              <span className="flex shrink-0 gap-[2vw] text-[1.3vw] font-bold text-slate-500">
                <span className="flex items-center gap-[0.5vw]">
                  <UsersIcon className="size-[1.7vw] text-green-700" aria-hidden />
                  <strong className="text-[2.3vw] font-black text-[#0c2e4e]">{s.waiting}</strong>
                  <span>aguardando</span>
                </span>
                <span className="flex items-center gap-[0.5vw]">
                  <FootprintsIcon className="size-[1.7vw] text-primary" aria-hidden />
                  <strong className="text-[2.3vw] font-black text-[#0c2e4e]">{s.onTheWay}</strong>
                  <span>a caminho</span>
                </span>
              </span>
            </li>
          ))}
        </ul>
        <section
          aria-label="QR de entrada"
          className={cn(CARD, "flex min-h-0 flex-col items-center justify-center gap-[0.6vw] p-[1vw]")}
        >
          {svg ? (
            <>
              <div
                className="aspect-square min-h-0 flex-1 [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
                // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG gerado localmente (qrEstilizado).
                dangerouslySetInnerHTML={{ __html: svg }}
              />
              <p className="text-[1.7vw] font-black">chegou? leia o QR</p>
            </>
          ) : (
            <p className="px-[1vw] text-center text-[1.6vw] font-bold text-slate-500">
              o QR aparece quando o atendimento abrir
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
