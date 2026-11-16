import type { TvEstado } from "@fila-saude/schemas/tv";
import { ArrowRightIcon, FootprintsIcon, UsersIcon } from "lucide-react";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

type Chamada = { id: string; senha: string; destino: string };

const CARTAO = "rounded-[1.6vw] border-[0.18vw] border-b-[0.45vw] border-[var(--ds-linha)] bg-white";
const ROTULO = "text-[1.25vw] font-extrabold tracking-[0.12em] text-slate-500 uppercase";

const hora = (agora: number) =>
  new Date(agora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false });

/**
 * A tela da TV pareada (RN-TV-02/03/05), branca e azul: topo com a marca, a unidade e a hora; a chamada
 * grande (azul cheio só enquanto anuncia), as últimas chamadas, os serviços e o QR de entrada.
 */
export function PainelDaTv({
  estado,
  atual,
  ultimas,
  svg,
  agora,
}: {
  estado: Extract<TvEstado, { estado: "pareada" }>;
  atual: Chamada | null;
  ultimas: Chamada[];
  svg: string | null;
  agora: number;
}) {
  return (
    <div className="flex h-screen flex-col bg-white text-[#0c2e4e]">
      <header className="grid grid-cols-3 items-center px-[2.6vw] pt-[1.8vw]">
        <span className="flex items-center gap-[0.6vw] text-[1.9vw] font-black">
          <Logo className="size-[2.3vw] text-primary" />
          fila saúde
        </span>
        <span className="truncate text-center text-[1.6vw] font-extrabold">{estado.unidade.nome}</span>
        <span className="text-right text-[2.2vw] font-black tabular-nums">{hora(agora)}</span>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-[2fr_1fr] grid-rows-[minmax(0,1.5fr)_minmax(0,1fr)] gap-[1.4vw] px-[2.6vw] pt-[1.4vw] pb-[2.6vw]">
        <section
          aria-label="chamando agora"
          aria-live="assertive"
          className={cn(
            CARTAO,
            "flex min-w-0 flex-col items-center justify-center gap-[0.8vw] px-[2vw]",
            atual && "border-[var(--ds-acao)] border-b-[var(--ds-acao-sombra)] bg-[var(--ds-acao)] text-white",
          )}
        >
          <p className={cn(ROTULO, atual && "text-[#cfe2f6]")}>chamando agora</p>
          {atual ? (
            <>
              <p className="max-w-full truncate text-[11vw] leading-none font-black tracking-wide">{atual.senha}</p>
              <p className="flex max-w-full items-center gap-[1vw] text-[3.6vw] font-black">
                <ArrowRightIcon className="size-[3.4vw] shrink-0" aria-hidden />
                <span className="truncate">{atual.destino.toLowerCase()}</span>
              </p>
            </>
          ) : (
            <>
              <p className="text-[3.6vw] font-black">
                {estado.atendimentoIniciado ? "aguarde a sua senha" : "atendimento ainda não começou"}
              </p>
              <p className="text-[1.6vw] font-bold text-slate-500">a senha aparece aqui quando chamarem</p>
            </>
          )}
        </section>
        <section aria-label="últimas chamadas" className={cn(CARTAO, "min-h-0 overflow-hidden p-[1.6vw]")}>
          <p className={cn(ROTULO, "mb-[0.6vw]")}>últimas chamadas</p>
          <ul>
            {ultimas.map((c) => (
              <li
                key={c.id}
                className="flex items-baseline justify-between gap-[1vw] border-[#eef2f3] border-t-[0.12vw] py-[0.9vw] first:border-t-0"
              >
                <span className="text-[2.1vw] font-black">{c.senha}</span>
                <span className="truncate text-[1.5vw] font-bold text-slate-500">{c.destino.toLowerCase()}</span>
              </li>
            ))}
          </ul>
        </section>
        <ul className="flex min-h-0 flex-col justify-center gap-[1vw] overflow-hidden">
          {estado.servicos.map((s) => (
            <li
              key={s.nome}
              aria-label={s.nome.toLowerCase()}
              className="flex items-center justify-between gap-[1vw] rounded-[1.2vw] bg-[#f4f7f8] px-[1.4vw] py-[1vw]"
            >
              <span className="truncate text-[1.8vw] font-black">{s.nome.toLowerCase()}</span>
              <span className="flex shrink-0 gap-[2vw] text-[1.3vw] font-bold text-slate-500">
                <span className="flex items-center gap-[0.5vw]">
                  <UsersIcon className="size-[1.7vw] text-green-700" aria-hidden />
                  <strong className="text-[2.3vw] font-black text-[#0c2e4e]">{s.aguardando}</strong>
                  <span>aguardando</span>
                </span>
                <span className="flex items-center gap-[0.5vw]">
                  <FootprintsIcon className="size-[1.7vw] text-primary" aria-hidden />
                  <strong className="text-[2.3vw] font-black text-[#0c2e4e]">{s.aCaminho}</strong>
                  <span>a caminho</span>
                </span>
              </span>
            </li>
          ))}
        </ul>
        <section
          aria-label="QR de entrada"
          className={cn(CARTAO, "flex min-h-0 flex-col items-center justify-center gap-[0.6vw] p-[1vw]")}
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
