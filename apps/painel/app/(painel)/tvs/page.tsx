"use client";

import type { TvDaUnidade } from "@fila-saude/schemas/tv";
import { useState } from "react";
import { Aviso, Campo, Cartao, classeDoCampo, Tabela } from "@/components/formulario";
import { SeletorDeUnidade } from "@/components/seletor-de-unidade";
import { Button } from "@/components/ui/button";
import { useApi } from "@/lib/api-context";
import { mensagemDoErro } from "@/lib/formularios/erros";
import { useUnidadeAtual } from "@/lib/unidade-atual";
import { useConsulta } from "@/lib/use-consulta";

const quando = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "nunca";

/** RN-TV-01 / RN-TV-06: parear pelo código que a TV mostra em `/tv`, ver se está online e revogar. */
export default function Tvs() {
  const api = useApi();
  const { unidades, atual, escolher, unidade } = useUnidadeAtual();
  const tvs = useConsulta<TvDaUnidade[]>(atual ? `/v1/painel/unidades/${atual}/tvs` : null, 15_000);
  const [codigo, setCodigo] = useState("");
  const [aviso, setAviso] = useState<{ texto: string; tipo: "erro" | "ok" } | null>(null);

  async function parear(e: React.FormEvent) {
    e.preventDefault();
    if (!atual) return;
    try {
      await api.post(`/v1/painel/unidades/${atual}/tvs`, { codigo: codigo.trim() });
      setCodigo("");
      setAviso({ texto: "TV pareada. Ela já mostra a fila da unidade.", tipo: "ok" });
      tvs.recarregar();
    } catch (err) {
      setAviso({ texto: mensagemDoErro(err), tipo: "erro" });
    }
  }

  async function revogar(id: string) {
    if (!window.confirm("Revogar esta TV? Ela volta para a tela de pareamento.")) return;
    try {
      await api.del(`/v1/painel/tvs/${id}`);
      tvs.recarregar();
    } catch (err) {
      setAviso({ texto: mensagemDoErro(err), tipo: "erro" });
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-bold text-gray-900">TVs da sala de espera</h1>
      <SeletorDeUnidade unidades={unidades} atual={atual} escolher={escolher} />
      <Cartao titulo="Parear uma TV">
        <p className="text-sm text-gray-600">
          Na TV, abra <strong>/tv</strong> neste mesmo endereço do painel. Ela mostra um código de 6 dígitos: digite
          aqui para ligá-la a {unidade?.nome ?? "esta unidade"}.
        </p>
        <form onSubmit={parear} className="flex items-end gap-3">
          <Campo rotulo="Código da TV">
            <input
              className={classeDoCampo}
              inputMode="numeric"
              maxLength={6}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
            />
          </Campo>
          <Button type="submit" disabled={codigo.length !== 6}>
            Parear
          </Button>
        </form>
        {aviso ? <Aviso texto={aviso.texto} tipo={aviso.tipo} /> : null}
      </Cartao>
      <Aviso texto={tvs.erro} />
      {tvs.dado?.length === 0 ? <p className="text-gray-600">Nenhuma TV pareada nesta unidade.</p> : null}
      {tvs.dado && tvs.dado.length > 0 ? (
        <Tabela cabecalho={["Pareada em", "Último sinal", "Situação", ""]}>
          {tvs.dado.map((t) => (
            <tr key={t.id}>
              <td className="py-2 pr-4">{quando(t.pareadaEm)}</td>
              <td className="py-2 pr-4">{quando(t.ultimoSinalEm)}</td>
              <td className="py-2 pr-4">
                <span className={t.online ? "font-semibold text-green-700" : "font-semibold text-gray-500"}>
                  {t.online ? "online" : "offline"}
                </span>
              </td>
              <td className="py-2 text-right">
                <Button variant="outline" size="sm" onClick={() => revogar(t.id)}>
                  Revogar
                </Button>
              </td>
            </tr>
          ))}
        </Tabela>
      ) : null}
    </div>
  );
}
