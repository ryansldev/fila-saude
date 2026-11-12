"use client";

import type { FilaDaSessao, HojeNaUnidade } from "@fila-saude/schemas/fila";
import { useEffect, useState } from "react";
import { Aviso, Campo, classeDoCampo, Tabela } from "@/components/formulario";
import { SeletorDeUnidade } from "@/components/seletor-de-unidade";
import { Button } from "@/components/ui/button";
import { useApi } from "@/lib/api-context";
import { acoesDaFila, ordenarFila, rotuloDoEstado, textoDasPendencias } from "@/lib/fila";
import { mensagemDoErro } from "@/lib/formularios/erros";
import { horarioParaTela } from "@/lib/formularios/sessao";
import { useEu } from "@/lib/sessao";
import { useUnidadeAtual } from "@/lib/unidade-atual";
import { useConsulta } from "@/lib/use-consulta";

const ESTADO_DA_SESSAO: Record<string, string> = {
  planejada: "Ainda não abriu",
  aberta: "Aberta",
  encerrada: "Encerrada",
};

export default function FilaDoDia() {
  const api = useApi();
  const eu = useEu();
  const { unidades, atual, escolher, unidade } = useUnidadeAtual();
  const fuso = unidade?.fuso ?? "America/Sao_Paulo";
  const hoje = useConsulta<HojeNaUnidade>(atual ? `/v1/painel/unidades/${atual}/hoje` : null, 15_000);
  const [sessaoId, setSessaoId] = useState<string | null>(null);
  const fila = useConsulta<FilaDaSessao>(sessaoId ? `/v1/painel/sessoes/${sessaoId}/fila` : null, 3_000);
  const [aviso, setAviso] = useState<string | null>(null);

  const sessoes = hoje.dado?.sessoes ?? [];
  useEffect(() => {
    if (sessoes.length === 0) setSessaoId(null);
    else if (!sessoes.some((s) => s.id === sessaoId))
      setSessaoId((sessoes.find((s) => s.estado === "aberta") ?? sessoes[0])?.id ?? null);
  }, [sessoes, sessaoId]);

  const perfis = eu.estado === "autenticado" ? eu.eu.perfis : [];
  const estado = fila.dado?.sessao.estado ?? "planejada";
  const pode = atual ? acoesDaFila(perfis, atual, estado) : { abrir: false, encerrar: false, presenca: false };

  async function agir(caminho: string, corpo: unknown, pergunta?: string) {
    if (pergunta && !window.confirm(pergunta)) return;
    try {
      fila.setDado(await api.post<FilaDaSessao>(caminho, corpo));
      setAviso(null);
      hoje.recarregar();
    } catch (e) {
      setAviso(mensagemDoErro(e));
    }
  }

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <h1 className="text-2xl font-bold text-gray-900">Fila do dia</h1>
      <div className="flex flex-wrap items-end gap-4">
        <SeletorDeUnidade unidades={unidades} atual={atual} escolher={escolher} />
        {sessoes.length > 0 ? (
          <Campo rotulo="Sessão">
            <select className={classeDoCampo} value={sessaoId ?? ""} onChange={(e) => setSessaoId(e.target.value)}>
              {sessoes.map((s) => (
                <option key={s.id} value={s.id}>
                  {horarioParaTela(s.inicio, fuso).hora}–{horarioParaTela(s.fim, fuso).hora} · {s.servico} ·{" "}
                  {ESTADO_DA_SESSAO[s.estado] ?? s.estado}
                </option>
              ))}
            </select>
          </Campo>
        ) : null}
      </div>
      <Aviso texto={aviso ?? hoje.erro ?? fila.erro} />
      {atual && hoje.dado && sessoes.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhuma sessão hoje nesta unidade.</p>
      ) : null}
      {fila.dado ? (
        <>
          <div className="flex flex-wrap items-center gap-4">
            <p className="text-gray-700">
              {ESTADO_DA_SESSAO[estado] ?? estado} · {fila.dado.sessao.ocupadas}
              {fila.dado.sessao.vagas === null ? "" : ` de ${fila.dado.sessao.vagas}`} vagas ocupadas
              {fila.dado.reserva > 0 ? ` · ${fila.dado.reserva} na reserva` : ""}
            </p>
            {pode.abrir ? (
              <Button onClick={() => agir(`/v1/painel/sessoes/${sessaoId}/abrir`, {}, "Abrir a sessão agora?")}>
                Abrir sessão
              </Button>
            ) : null}
            {pode.encerrar ? (
              <Button
                variant="outline"
                onClick={() =>
                  agir(
                    `/v1/painel/sessoes/${sessaoId}/encerrar`,
                    {},
                    "Encerrar a sessão? Quem ainda está na fila vai ser remanejado ou levar falta.",
                  )
                }
              >
                Encerrar sessão
              </Button>
            ) : null}
          </div>
          {estado === "planejada" ? (
            <p className="text-sm text-gray-500">
              As senhas saem quando a sessão abrir. Inscritos até agora: {fila.dado.sessao.ocupadas}.
            </p>
          ) : (
            <Tabela cabecalho={["Senha", "Nome", "Etapa", "Situação", ""]}>
              {ordenarFila(fila.dado.itens).map((i) => (
                <tr key={i.id}>
                  <td className="py-2 pr-4 font-mono font-semibold">{i.senha}</td>
                  <td className="py-2 pr-4">
                    {i.nome}
                    {i.prioridade ? <span className="ml-2 text-xs text-primary">prioridade</span> : null}
                  </td>
                  <td className="py-2 pr-4">{i.etapa === "triagem" ? "Triagem" : "Atendimento"}</td>
                  <td className="py-2 pr-4">
                    {rotuloDoEstado(i.estado)}
                    {i.pulos > 0 ? ` · ${i.pulos} pulo(s)` : ""}
                    {i.estado === "remoto" && textoDasPendencias(i.pendencias) ? (
                      <span className="block text-xs text-orange-700">{textoDasPendencias(i.pendencias)}</span>
                    ) : null}
                  </td>
                  <td className="py-2">
                    {pode.presenca && i.estado === "remoto" && i.pendencias.length > 0 ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          agir(`/v1/painel/sessoes/${sessaoId}/presenca`, {
                            entradaId: i.entradaId,
                            resultado: "confere",
                          })
                        }
                      >
                        Conferir documentos e marcar presença
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </Tabela>
          )}
        </>
      ) : null}
    </div>
  );
}
