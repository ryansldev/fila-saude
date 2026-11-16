import type { AlocacaoDaSessao } from "@fila-saude/schemas/fila";
import { Button } from "@/components/ui/button";
import { alocarAte, quandoNoFuso, situacaoDoAlocado, textoDasVagas } from "@/lib/agendamento";
import { BarrasDeVagas } from "./barras-de-vagas";
import { Selo } from "./selo";
import type { Resposta } from "./tipos";

/** As vagas da sessão escolhida: quantas, até quando alocar e quem já está nelas. */
export function VagasDaSessao({
  d,
  fuso,
  enviando,
  responder,
}: {
  d: AlocacaoDaSessao;
  fuso: string;
  enviando: boolean;
  responder: (entradaId: string, nome: string, r: Resposta) => void;
}) {
  const confirmadas = d.alocados.filter((a) => a.estado !== "alocada").length;
  const pendentes = d.alocados.length - confirmadas;
  return (
    <section className="rounded-2xl border border-slate-200 bg-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-base font-extrabold text-slate-900">
            {d.sessao.vagas === null
              ? textoDasVagas(d.sessao.ocupadas, null)
              : `Vagas ocupadas · ${d.sessao.ocupadas} de ${d.sessao.vagas}`}
          </h2>
          <span className="text-sm text-slate-500">
            {d.sessao.podeAlocar ? `alocação até ${alocarAte(d.sessao.inicio, fuso)}` : d.sessao.motivo}
          </span>
        </div>
        <BarrasDeVagas
          vagas={d.sessao.vagas}
          ocupadas={d.sessao.ocupadas}
          confirmadas={confirmadas}
          pendentes={pendentes}
        />
      </header>
      {d.alocados.length === 0 ? (
        <p className="px-5 py-4 text-slate-600">Ninguém alocado ainda. Comece pela sugestão abaixo.</p>
      ) : (
        <ul>
          {d.alocados.map((a) => {
            const s = situacaoDoAlocado(a);
            return (
              <li
                key={a.entradaId}
                className="flex flex-wrap items-center gap-3 border-t border-slate-100 px-5 py-3 first:border-t-0"
              >
                <div className="min-w-0 flex-1">
                  <span className="font-bold text-slate-900">{a.nome}</span>
                  <span className="text-slate-500"> · {a.idade} anos</span>
                  {a.prazo ? (
                    <div className="text-sm text-slate-500">confirmar até {quandoNoFuso(a.prazo, fuso)}</div>
                  ) : null}
                </div>
                <Selo texto={s.rotulo} tom={s.tom} />
                {a.estado === "alocada" ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      tamanho="compacto"
                      variante="sucesso"
                      disabled={enviando}
                      onClick={() => responder(a.entradaId, a.nome, "confirmou")}
                    >
                      Confirmou
                    </Button>
                    <Button
                      tamanho="compacto"
                      variante="secundario"
                      disabled={enviando}
                      onClick={() => responder(a.entradaId, a.nome, "sem_contato")}
                    >
                      Sem contato
                    </Button>
                    <Button
                      tamanho="compacto"
                      variante="perigoContorno"
                      disabled={enviando}
                      onClick={() => responder(a.entradaId, a.nome, "recusou")}
                    >
                      Recusou
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
