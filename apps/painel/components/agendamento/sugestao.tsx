import type { AlocacaoDaSessao } from "@fila-saude/schemas/fila";
import { Button } from "@/components/ui/button";
import { linhaDeMotivos, seloDoRisco } from "@/lib/agendamento";
import { Selo } from "./selo";

/**
 * RN-AL-01/02: quem o sistema sugere para as vagas, na ordem, com os motivos. Só o primeiro leva o
 * botão principal (uma ação principal por área); nada é alocado sozinho (INV-08).
 */
export function Sugestao({
  d,
  enviando,
  alocar,
}: {
  d: AlocacaoDaSessao;
  enviando: boolean;
  alocar: (entradaId: string, nome: string) => void;
}) {
  const livres = d.sessao.vagas === null ? null : Math.max(0, d.sessao.vagas - d.sessao.ocupadas);
  const titulo =
    livres === null
      ? "Sugestão"
      : livres === 0
        ? "Sugestão (sem vagas livres)"
        : `Sugestão para ${livres === 1 ? "a vaga livre" : `as ${livres} vagas livres`}`;
  return (
    <section className="rounded-2xl border border-slate-200 bg-white">
      <header className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-base font-extrabold text-slate-900">{titulo}</h2>
      </header>
      {d.sugestao.length === 0 ? (
        <p className="px-5 py-4 text-slate-600">Ninguém na lista para esta sessão.</p>
      ) : (
        <ul>
          {d.sugestao.map((x, i) => {
            const risco = seloDoRisco(x.risco);
            return (
              <li
                key={x.entradaId}
                className={`flex flex-wrap items-center gap-3 border-t border-slate-100 px-5 py-3 first:border-t-0 ${x.alerta ? "bg-amber-50" : ""}`}
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-slate-900">{x.nome}</span>
                    <span className="text-slate-500">· {x.idade} anos</span>
                    {x.semApp ? <span className="text-slate-500">· sem app</span> : null}
                    {risco ? <Selo texto={risco.rotulo} tom={risco.tom} /> : null}
                    {x.autolesao ? <Selo texto="Risco de autolesão · CVV 188 · SAMU 192" tom="perigo" /> : null}
                    {x.alertaFaltas ? <Selo texto={`${x.faltas} faltas recentes`} tom="neutro" /> : null}
                  </div>
                  <span className="text-sm text-slate-600" title={x.risco.regra}>
                    {linhaDeMotivos(x.risco, x.motivos)}
                  </span>
                </div>
                <Button
                  tamanho="compacto"
                  variante={i === 0 ? "principal" : "secundario"}
                  disabled={enviando || !d.sessao.podeAlocar}
                  onClick={() => alocar(x.entradaId, x.nome)}
                >
                  Alocar
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
