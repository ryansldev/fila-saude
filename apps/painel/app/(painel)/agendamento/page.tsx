"use client";

import type { AlocacaoDaSessao, ItemDeLigacao, ListaDeEsperaDoServico } from "@fila-saude/schemas/fila";
import { useEffect, useState } from "react";
import { useConfirmar } from "@/components/dialogos";
import { Aviso, Campo, Selecao, Tabela } from "@/components/formulario";
import { CabecalhoDaPagina } from "@/components/pagina";
import { SeletorDeUnidade } from "@/components/seletor-de-unidade";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { CLASSES_DO_TOM, quandoNoFuso, rotuloDoRisco, situacaoDoAlocado, textoDasVagas } from "@/lib/agendamento";
import { ErroDaApi } from "@/lib/api";
import { useApi } from "@/lib/api-context";
import { mensagemDoErro } from "@/lib/formularios/erros";
import { useUnidadeAtual } from "@/lib/unidade-atual";
import { useConsulta } from "@/lib/use-consulta";

type Aba = "alocar" | "ligacao";

function Selo({ texto, classe }: { texto: string; classe: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${classe}`}>{texto}</span>;
}

/**
 * Agendamento (T5.3, T5.4): a lista de espera de cada serviço, as sessões privadas que vêm, a sugestão
 * com os motivos, os alocados e a lista de ligação. Nada é alocado sozinho (INV-08).
 */
export default function Agendamento() {
  const api = useApi();
  const confirmar = useConfirmar();
  const {
    unidades,
    atual,
    escolher,
    erro: erroDasUnidades,
    unidade,
  } = useUnidadeAtual(["alocar_confirmar_recusar_pelo_paciente"]);
  const fuso = unidade?.fuso ?? "America/Sao_Paulo";
  const [aba, setAba] = useState<Aba>("alocar");
  const lista = useConsulta<ListaDeEsperaDoServico[]>(
    atual ? `/v1/painel/unidades/${atual}/lista-espera` : null,
    30_000,
  );
  const ligacao = useConsulta<ItemDeLigacao[]>(
    atual && aba === "ligacao" ? `/v1/painel/unidades/${atual}/ligacao` : null,
    30_000,
  );
  const [servicoId, setServicoId] = useState<string | null>(null);
  const [sessaoId, setSessaoId] = useState<string | null>(null);
  const alocacao = useConsulta<AlocacaoDaSessao>(sessaoId ? `/v1/painel/sessoes/${sessaoId}/alocacao` : null, 10_000);
  const [aviso, setAviso] = useState<{ texto: string; tipo: "erro" | "ok" } | null>(null);
  const [enviando, setEnviando] = useState(false);

  const servicos = (lista.dado ?? []).filter((s) => s.servico.modo !== "regulado");
  const servico = servicos.find((s) => s.servico.id === servicoId) ?? null;

  // Escolhe o primeiro serviço (o de mais alertas) e a primeira sessão; troca de unidade recomeça.
  useEffect(() => {
    if (!lista.dado) return;
    if (servicos.some((s) => s.servico.id === servicoId)) return;
    const primeiro = [...servicos].sort((a, b) => b.alertas - a.alertas)[0];
    setServicoId(primeiro?.servico.id ?? null);
  }, [lista.dado, servicos, servicoId]);
  useEffect(() => {
    if (!servico) {
      setSessaoId(null);
      return;
    }
    if (servico.sessoes.some((s) => s.id === sessaoId)) return;
    setSessaoId(servico.sessoes[0]?.id ?? null);
  }, [servico, sessaoId]);

  async function alocar(entradaId: string, nome: string) {
    setEnviando(true);
    try {
      alocacao.setDado(await api.post<AlocacaoDaSessao>(`/v1/painel/sessoes/${sessaoId}/alocar`, { entradaId }));
      setAviso({ texto: `${nome} alocada. O app pede a confirmação; se não responder, ligue.`, tipo: "ok" });
      lista.recarregar();
    } catch (e) {
      // I7: outro agendador mexeu antes; a resposta traz a lista atualizada.
      const nova = e instanceof ErroDaApi ? (e.dados?.alocacao as AlocacaoDaSessao | undefined) : undefined;
      if (nova) alocacao.setDado(nova);
      setAviso({ texto: mensagemDoErro(e), tipo: "erro" });
    } finally {
      setEnviando(false);
    }
  }

  async function responder(entradaId: string, nome: string, resposta: "confirmou" | "recusou" | "sem_contato") {
    if (
      resposta === "recusou" &&
      !(await confirmar({
        titulo: `${nome} recusou?`,
        descricao: "A vaga fica livre e a pessoa volta para a lista com a data de entrada de antes.",
        acao: "Registrar recusa",
        perigo: true,
      }))
    )
      return;
    setEnviando(true);
    try {
      await api.post(`/v1/painel/entradas/${entradaId}/resposta`, { resposta });
      const textos = {
        confirmou: `${nome} confirmou.`,
        recusou: `Recusa registrada. A vaga está livre.`,
        sem_contato: `Tentativa anotada. Tente de novo mais tarde.`,
      };
      setAviso({ texto: textos[resposta], tipo: "ok" });
      alocacao.recarregar();
      ligacao.recarregar();
      lista.recarregar();
    } catch (e) {
      setAviso({ texto: mensagemDoErro(e), tipo: "erro" });
    } finally {
      setEnviando(false);
    }
  }

  const d = alocacao.dado;
  return (
    <div className="flex w-full flex-col gap-6">
      <CabecalhoDaPagina
        titulo="Agendamento"
        descricao="Escolha quem ocupa as vagas das sessões privadas. O sistema sugere, você decide."
      />
      <div className="flex flex-wrap items-end gap-4">
        <SeletorDeUnidade unidades={unidades} atual={atual} escolher={escolher} erro={erroDasUnidades} />
        <div className="flex gap-2" role="tablist">
          <Button variante={aba === "alocar" ? "principal" : "secundario"} onClick={() => setAba("alocar")}>
            Alocar
          </Button>
          <Button variante={aba === "ligacao" ? "principal" : "secundario"} onClick={() => setAba("ligacao")}>
            Lista de ligação
          </Button>
        </div>
      </div>
      <Aviso texto={aviso?.texto ?? lista.erro ?? alocacao.erro ?? ligacao.erro} tipo={aviso?.tipo ?? "erro"} />

      {aba === "ligacao" ? (
        ligacao.dado && ligacao.dado.length === 0 ? (
          <p className="text-slate-600">Ninguém esperando resposta. Toda alocação pendente aparece aqui.</p>
        ) : (
          <Tabela cabecalho={["Pessoa", "Telefone", "Sessão", "Confirmar até", "Última tentativa", ""]}>
            {(ligacao.dado ?? []).map((i) => (
              <TableRow key={i.entradaId} className={i.destacada ? "bg-amber-50" : undefined}>
                <TableCell className="font-medium text-slate-900">
                  {i.nome}
                  {i.destacada ? (
                    <div className="mt-1">
                      <Selo texto="Sem resposta: ligar" classe={CLASSES_DO_TOM.alerta} />
                    </div>
                  ) : null}
                </TableCell>
                <TableCell>{i.telefone ?? "sem app: procurar na recepção"}</TableCell>
                <TableCell>
                  {i.servico} · {quandoNoFuso(i.sessao.inicio, fuso)}
                </TableCell>
                <TableCell>{quandoNoFuso(i.prazo, fuso)}</TableCell>
                <TableCell>{i.ultimaTentativa ? quandoNoFuso(i.ultimaTentativa, fuso) : "—"}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap justify-end gap-2">
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
                </TableCell>
              </TableRow>
            ))}
          </Tabela>
        )
      ) : (
        <>
          {lista.dado && servicos.length === 0 ? (
            <p className="text-slate-600">Nenhum serviço com lista de espera nesta unidade.</p>
          ) : null}
          {servicos.length > 0 ? (
            <div className="flex flex-wrap items-end gap-4">
              <Campo rotulo="Serviço" className="w-full sm:w-72">
                <Selecao
                  className="w-full"
                  valor={servicoId ?? ""}
                  aoMudar={(id) => id && setServicoId(id)}
                  opcoes={servicos.map((s) => ({
                    valor: s.servico.id,
                    rotulo: `${s.servico.nome} · ${s.aguardando} na lista${s.alertas > 0 ? ` · ${s.alertas} alerta(s)` : ""}`,
                  }))}
                />
              </Campo>
              {servico && servico.sessoes.length > 0 ? (
                <Campo rotulo="Sessão privada" className="w-full sm:w-96">
                  <Selecao
                    className="w-full"
                    valor={sessaoId ?? ""}
                    aoMudar={(id) => id && setSessaoId(id)}
                    opcoes={servico.sessoes.map((s) => ({
                      valor: s.id,
                      rotulo: `${quandoNoFuso(s.inicio, fuso)} · ${textoDasVagas(s.ocupadas, s.vagas)}${s.profissional ? ` · ${s.profissional}` : ""}`,
                    }))}
                  />
                </Campo>
              ) : null}
            </div>
          ) : null}
          {servico && servico.alertas > 0 ? (
            <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
              {servico.alertas === 1 ? "1 pessoa" : `${servico.alertas} pessoas`} com urgência sugerida pelo app
              esperando vaga. Elas aparecem no topo da sugestão.
            </p>
          ) : null}
          {servico && servico.sessoes.length === 0 ? (
            <p className="text-slate-600">
              Nenhuma sessão privada planejada para este serviço. Crie uma em Sessões para alocar a lista.
            </p>
          ) : null}

          {d ? (
            <>
              <section className="flex flex-col gap-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-lg font-bold text-slate-900">
                    Alocados · {textoDasVagas(d.sessao.ocupadas, d.sessao.vagas)}
                  </h2>
                  {d.sessao.motivo ? <span className="text-sm text-slate-500">{d.sessao.motivo}</span> : null}
                </div>
                {d.alocados.length === 0 ? (
                  <p className="text-slate-600">Ninguém alocado ainda.</p>
                ) : (
                  <Tabela cabecalho={["Pessoa", "Situação", "Confirmar até", ""]}>
                    {d.alocados.map((a) => {
                      const s = situacaoDoAlocado(a);
                      return (
                        <TableRow key={a.entradaId}>
                          <TableCell className="font-medium text-slate-900">
                            {a.nome} <span className="text-slate-500">· {a.idade} anos</span>
                          </TableCell>
                          <TableCell>
                            <Selo texto={s.rotulo} classe={CLASSES_DO_TOM[s.tom]} />
                          </TableCell>
                          <TableCell>{a.prazo ? quandoNoFuso(a.prazo, fuso) : "—"}</TableCell>
                          <TableCell>
                            {a.estado === "alocada" ? (
                              <div className="flex flex-wrap justify-end gap-2">
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
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </Tabela>
                )}
              </section>

              <section className="flex flex-col gap-3">
                <h2 className="text-lg font-bold text-slate-900">Sugestão para as vagas</h2>
                {d.sugestao.length === 0 ? (
                  <p className="text-slate-600">Ninguém na lista para esta sessão.</p>
                ) : (
                  <Tabela cabecalho={["#", "Pessoa", "Risco", "Por quê", ""]}>
                    {d.sugestao.map((x, i) => (
                      <TableRow key={x.entradaId} className={x.alerta ? "bg-amber-50" : undefined}>
                        <TableCell className="text-slate-500">{i + 1}</TableCell>
                        <TableCell className="font-medium text-slate-900">
                          {x.nome} <span className="text-slate-500">· {x.idade} anos</span>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {x.alerta ? <Selo texto="Alerta: urgente" classe={CLASSES_DO_TOM.alerta} /> : null}
                            {x.autolesao ? (
                              <Selo texto="Risco de autolesão: CVV 188 · SAMU 192" classe="bg-red-100 text-red-900" />
                            ) : null}
                            {x.alertaFaltas ? (
                              <Selo texto={`${x.faltas} faltas recentes`} classe="bg-slate-200 text-slate-800" />
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          {rotuloDoRisco(x.risco)}
                          <div className="text-xs text-slate-500">{x.risco.regra}</div>
                        </TableCell>
                        <TableCell className="text-slate-700">{x.motivos.join(" · ")}</TableCell>
                        <TableCell>
                          <div className="flex justify-end">
                            <Button
                              tamanho="compacto"
                              disabled={enviando || !d.sessao.podeAlocar}
                              onClick={() => alocar(x.entradaId, x.nome)}
                            >
                              Alocar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </Tabela>
                )}
              </section>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
