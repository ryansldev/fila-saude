"use client";

import { type FilaDaSessao, type HojeNaUnidade, presencaEntradaSchema } from "@fila-saude/schemas/fila";
import { useEffect, useState } from "react";
import { useConfirmar, usePerguntar } from "@/components/dialogos";
import { Aviso, Campo, Selecao, Tabela } from "@/components/formulario";
import { SeletorDeUnidade } from "@/components/seletor-de-unidade";
import { Button } from "@/components/ui/button";
import { useApi } from "@/lib/api-context";
import {
  acoesDaFila,
  botoesDePresenca,
  ordenarFila,
  rotuloDoEstado,
  textoDasPendencias,
  textoDoDocumento,
} from "@/lib/fila";
import { mensagemDoErro, validarNoCliente } from "@/lib/formularios/erros";
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
  const confirmar = useConfirmar();
  const perguntar = usePerguntar();
  const eu = useEu();
  const {
    unidades,
    atual,
    escolher,
    unidade,
    erro: erroDasUnidades,
  } = useUnidadeAtual(["abrir_cancelar_encerrar_sessao", "conferir_e_marcar_presenca", "operar_chamadas"]);
  const fuso = unidade?.fuso ?? "America/Sao_Paulo";
  const hoje = useConsulta<HojeNaUnidade>(atual ? `/v1/painel/unidades/${atual}/hoje` : null, 15_000);
  const [sessaoId, setSessaoId] = useState<string | null>(null);
  const fila = useConsulta<FilaDaSessao>(sessaoId ? `/v1/painel/sessoes/${sessaoId}/fila` : null, 3_000);
  const [aviso, setAviso] = useState<string | null>(null);

  const sessoes = hoje.dado?.sessoes ?? [];
  useEffect(() => {
    // Enquanto /hoje carrega, mantém a sessão escolhida (antes ela era trocada a cada ação).
    if (!hoje.dado) return;
    if (sessoes.length === 0) setSessaoId(null);
    else if (!sessoes.some((s) => s.id === sessaoId))
      setSessaoId((sessoes.find((s) => s.estado === "aberta") ?? sessoes[0])?.id ?? null);
  }, [hoje.dado, sessoes, sessaoId]);

  const perfis = eu.estado === "autenticado" ? eu.eu.perfis : [];
  const estado = fila.dado?.sessao.estado ?? "planejada";
  const pode = atual ? acoesDaFila(perfis, atual, estado) : { abrir: false, encerrar: false, presenca: false };

  async function agir(
    caminho: string,
    corpo: unknown,
    pergunta?: { titulo: string; descricao?: string; acao?: string; perigo?: boolean },
  ) {
    if (pergunta && !(await confirmar(pergunta))) return;
    try {
      fila.setDado(await api.post<FilaDaSessao>(caminho, corpo));
      setAviso(null);
      hoje.recarregar();
    } catch (e) {
      setAviso(mensagemDoErro(e));
    }
  }

  /** Confere o corpo com o schema da API antes de enviar a presença. */
  async function presenca(corpo: { entradaId: string; resultado: "confere" | "nao_confere"; motivo?: string }) {
    const invalidos = validarNoCliente(presencaEntradaSchema, corpo);
    if (invalidos) return setAviso(invalidos.geral ?? Object.values(invalidos.campos)[0] ?? "Confira os dados.");
    await agir(`/v1/painel/sessoes/${sessaoId}/presenca`, corpo);
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <h1 className="text-2xl font-bold text-gray-900">Fila do dia</h1>
      <div className="flex flex-wrap items-end gap-4">
        <SeletorDeUnidade unidades={unidades} atual={atual} escolher={escolher} erro={erroDasUnidades} />
        {sessoes.length > 0 ? (
          <Campo rotulo="Sessão">
            <Selecao
              className="w-full min-w-72"
              valor={sessaoId ?? ""}
              aoMudar={(id) => id && setSessaoId(id)}
              placeholder="Escolha a sessão"
              opcoes={sessoes.map((s) => ({
                valor: s.id,
                rotulo: `${horarioParaTela(s.inicio, fuso).hora}–${horarioParaTela(s.fim, fuso).hora} · ${s.servico} · ${
                  ESTADO_DA_SESSAO[s.estado] ?? s.estado
                }`,
              }))}
            />
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
              <Button
                onClick={() =>
                  agir(`/v1/painel/sessoes/${sessaoId}/abrir`, {}, { titulo: "Abrir a sessão agora?", acao: "Abrir" })
                }
              >
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
                    {
                      titulo: "Encerrar a sessão?",
                      descricao: "Quem ainda está na fila vai ser remanejado ou levar falta.",
                      acao: "Encerrar",
                      perigo: true,
                    },
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
                    {i.estado === "remoto" && pode.presenca ? (
                      <span className="block text-xs text-gray-500">{textoDoDocumento(i.documento)}</span>
                    ) : null}
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
                    {(() => {
                      const b = botoesDePresenca(i, pode.presenca);
                      if (!b) return null;
                      return (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => presenca({ entradaId: i.entradaId, resultado: "confere" })}
                          >
                            {b.marcar}
                          </Button>
                          {b.naoConfere ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                // AD-039: recusar tira da fila de hoje, sem falta; sempre com motivo.
                                const motivo = await perguntar({
                                  titulo: "Documentos não conferem",
                                  descricao: "O paciente sai da fila de hoje, sem falta.",
                                  rotulo: "Motivo",
                                  acao: "Não confere",
                                });
                                if (!motivo) return;
                                await presenca({ entradaId: i.entradaId, resultado: "nao_confere", motivo });
                              }}
                            >
                              Não confere
                            </Button>
                          ) : null}
                        </div>
                      );
                    })()}
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
