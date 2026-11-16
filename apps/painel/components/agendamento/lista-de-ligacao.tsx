import type { ItemDeLigacao } from "@fila-saude/schemas/fila";
import { PhoneIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { quandoNoFuso } from "@/lib/agendamento";
import { Selo } from "./selo";
import type { Resposta } from "./tipos";

/** RN-CONF-03: quem foi alocado e não respondeu, pela sessão mais próxima; destacado depois do prazo. */
export function ListaDeLigacao({
  itens,
  fuso,
  enviando,
  responder,
}: {
  itens: ItemDeLigacao[];
  fuso: string;
  enviando: boolean;
  responder: (entradaId: string, nome: string, r: Resposta) => void;
}) {
  if (itens.length === 0)
    return <p className="text-slate-600">Ninguém esperando resposta. Toda alocação pendente aparece aqui.</p>;
  return (
    <ul className="flex flex-col gap-3">
      {itens.map((i) => (
        <li
          key={i.entradaId}
          className={`flex flex-col gap-3 rounded-xl border p-4 ${i.destacada ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"}`}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex flex-col gap-1">
              <span className="font-bold text-slate-900">{i.nome}</span>
              <span className="text-sm text-slate-600">
                {i.servico} · {quandoNoFuso(i.sessao.inicio, fuso)}
              </span>
            </div>
            {i.destacada ? <Selo texto="Sem resposta: ligar" tom="alerta" /> : null}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="inline-flex items-center gap-1.5 font-bold text-slate-900">
              <PhoneIcon className="size-4" aria-hidden />
              {i.telefone ?? "sem app: procurar na recepção"}
            </span>
            <span className="text-slate-600">confirmar até {quandoNoFuso(i.prazo, fuso)}</span>
            {i.ultimaTentativa ? (
              <span className="text-slate-600">última tentativa {quandoNoFuso(i.ultimaTentativa, fuso)}</span>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              tamanho="compacto"
              variante="sucesso"
              disabled={enviando}
              onClick={() => responder(i.entradaId, i.nome, "confirmou")}
            >
              Confirmou
            </Button>
            <Button
              tamanho="compacto"
              variante="secundario"
              disabled={enviando}
              onClick={() => responder(i.entradaId, i.nome, "sem_contato")}
            >
              Sem contato
            </Button>
            <Button
              tamanho="compacto"
              variante="perigoContorno"
              disabled={enviando}
              onClick={() => responder(i.entradaId, i.nome, "recusou")}
            >
              Recusou
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
