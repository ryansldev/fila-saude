"use client";

import { sessaoEdicaoSchema, sessaoEntradaSchema, visibilidadeEntradaSchema } from "@fila-saude/schemas/sessao";
import { type FormEvent, useEffect, useState } from "react";
import { useConfirmar } from "@/components/dialogos";
import { Aviso, Caixa, Campo, Cartao, Selecao, Tabela, Texto } from "@/components/formulario";
import { SeletorDeUnidade } from "@/components/seletor-de-unidade";
import { Button } from "@/components/ui/button";
import { useApi } from "@/lib/api-context";
import { type ErrosDoEnvio, errosDoEnvio, mensagemDoErro, validarNoCliente } from "@/lib/formularios/erros";
import {
  ajustarVisibilidade,
  diaValido,
  estacoesDoServico,
  hojeNoFuso,
  horarioParaEnvio,
  horarioParaTela,
  intervaloDoDia,
  lerVagas,
  type Visibilidade,
  visibilidadesPermitidas,
} from "@/lib/formularios/sessao";
import { useUnidadeAtual } from "@/lib/unidade-atual";
import { useLista } from "@/lib/use-lista";

type Sessao = {
  id: string;
  servicoId: string;
  inicio: string;
  fim: string;
  vagas: number | null;
  ocupadas: number;
  visibilidade: Visibilidade;
  dispensaPreCadastro: boolean;
  profissional: string | null;
  estacoes: string[];
  estado: string;
  versao: number;
};
type Servico = { id: string; nome: string; modo: string };
type Estacao = { id: string; nome: string; servicos: string[] };

const SEM_ERROS: ErrosDoEnvio = { geral: null, campos: {} };

/** Horário digitado → ISO; vazio ou inválido vira "" para o schema apontar o campo. */
function horarioOuVazio(data: string, hora: string, fuso: string): string {
  try {
    return horarioParaEnvio(data, hora, fuso);
  } catch {
    return "";
  }
}

export default function Sessoes() {
  const api = useApi();
  const confirmar = useConfirmar();
  const {
    unidades,
    atual,
    escolher,
    unidade,
    erro: erroDasUnidades,
  } = useUnidadeAtual(["configurar_servicos_sessoes_estacoes_tv"]);
  const fuso = unidade?.fuso ?? "America/Sao_Paulo";
  const [dia, setDia] = useState(() => hojeNoFuso("America/Sao_Paulo"));
  // O dia padrão segue o fuso da unidade (Acre e Amazonas viram o dia antes de Brasília).
  const fusoDoDia = unidade?.fuso;
  useEffect(() => {
    if (fusoDoDia) setDia(hojeNoFuso(fusoDoDia));
  }, [fusoDoDia]);
  const intervalo = intervaloDoDia(dia, fuso);
  const sessoes = useLista<Sessao>(
    atual
      ? `/v1/painel/unidades/${atual}/sessoes?de=${encodeURIComponent(intervalo.de)}&ate=${encodeURIComponent(intervalo.ate)}`
      : null,
  );
  const { itens: servicos } = useLista<Servico>(atual ? `/v1/painel/unidades/${atual}/servicos` : null);
  const { itens: estacoes } = useLista<Estacao>(atual ? `/v1/painel/unidades/${atual}/estacoes` : null);

  const [v, setV] = useState({
    servicoId: "",
    inicio: "08:00",
    fim: "12:00",
    vagas: "",
    visibilidade: "privada" as Visibilidade,
    dispensaPreCadastro: false,
    profissional: "",
    estacoes: [] as string[],
  });
  const [erros, setErros] = useState(SEM_ERROS);
  const [aviso, setAviso] = useState<string | null>(null);
  // Edição das vagas na própria linha da tabela (vazio = sem limite).
  const [vagasEmEdicao, setVagasEmEdicao] = useState<{ id: string; texto: string; erro?: string } | null>(null);
  // Trocou de unidade: serviço e estações escolhidos eram da anterior.
  // biome-ignore lint/correctness/useExhaustiveDependencies: só ao trocar de unidade.
  useEffect(() => {
    setV((x) => ({ ...x, servicoId: "", estacoes: [] }));
    setErros(SEM_ERROS);
    setAviso(null);
  }, [atual]);

  const servico = servicos.find((s) => s.id === v.servicoId);
  const permitidas = visibilidadesPermitidas(servico?.modo ?? "livre");
  const nome = (id: string, lista: { id: string; nome: string }[]) => lista.find((x) => x.id === id)?.nome ?? "?";

  async function criar(e: FormEvent) {
    e.preventDefault();
    const vagas = lerVagas(v.vagas);
    if (!vagas.ok) return setErros({ geral: null, campos: { vagas: vagas.erro } });
    const corpo = {
      servicoId: v.servicoId,
      inicio: horarioOuVazio(dia, v.inicio, fuso),
      fim: horarioOuVazio(dia, v.fim, fuso),
      vagas: vagas.vagas,
      visibilidade: v.visibilidade,
      dispensaPreCadastro: v.visibilidade === "publica" && v.dispensaPreCadastro,
      profissional: v.profissional.trim() || null,
      estacoes: v.estacoes,
    };
    const invalidos = validarNoCliente(sessaoEntradaSchema, corpo);
    if (invalidos) return setErros(invalidos);
    try {
      await api.post(`/v1/painel/unidades/${atual}/sessoes`, corpo);
      setErros(SEM_ERROS);
      sessoes.recarregar();
    } catch (err) {
      setErros(errosDoEnvio(err));
    }
  }

  async function agir(s: Sessao, acao: "visibilidade" | "cancelar") {
    const para = s.visibilidade === "publica" ? "privada" : "publica";
    const ok = await confirmar(
      acao === "cancelar"
        ? { titulo: "Cancelar esta sessão?", acao: "Cancelar sessão", perigo: true }
        : { titulo: `Tornar esta sessão ${para === "privada" ? "privada" : "pública"}?` },
    );
    if (!ok) return;
    const corpo = { visibilidade: para, versao: s.versao };
    if (acao === "visibilidade") {
      const invalidos = validarNoCliente(visibilidadeEntradaSchema, corpo);
      if (invalidos) return setAviso(invalidos.geral ?? Object.values(invalidos.campos)[0] ?? null);
    }
    try {
      if (acao === "cancelar") await api.post(`/v1/painel/sessoes/${s.id}/cancelar`, {});
      else await api.post(`/v1/painel/sessoes/${s.id}/visibilidade`, corpo);
      setAviso(null);
      sessoes.recarregar();
    } catch (err) {
      setAviso(mensagemDoErro(err));
    }
  }

  async function salvarVagas(e: FormEvent, s: Sessao) {
    e.preventDefault();
    if (!vagasEmEdicao) return;
    const vagas = lerVagas(vagasEmEdicao.texto);
    if (!vagas.ok) return setVagasEmEdicao({ ...vagasEmEdicao, erro: vagas.erro });
    const corpo = { vagas: vagas.vagas, versao: s.versao };
    const invalidos = validarNoCliente(sessaoEdicaoSchema, corpo);
    if (invalidos)
      return setVagasEmEdicao({
        ...vagasEmEdicao,
        erro: invalidos.campos.vagas ?? invalidos.geral ?? "Confira as vagas.",
      });
    try {
      await api.patch(`/v1/painel/sessoes/${s.id}`, corpo);
      setVagasEmEdicao(null);
      setAviso(null);
      sessoes.recarregar();
    } catch (err) {
      setAviso(mensagemDoErro(err));
    }
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <h1 className="text-2xl font-bold text-gray-900">Sessões</h1>
      <div className="flex flex-wrap items-end gap-4">
        <SeletorDeUnidade unidades={unidades} atual={atual} escolher={escolher} erro={erroDasUnidades} />
        <Campo rotulo="Dia">
          <Texto type="date" valor={dia} aoMudar={(novo) => diaValido(novo) && setDia(novo)} />
        </Campo>
      </div>
      <Aviso texto={sessoes.erro ?? aviso} />
      {atual ? (
        <>
          <Tabela cabecalho={["Horário", "Serviço", "Vagas", "Visibilidade", "Profissional", "Estado", ""]}>
            {sessoes.itens.map((s) => (
              <tr key={s.id}>
                <td className="py-2 pr-4 font-medium">
                  {horarioParaTela(s.inicio, fuso).hora}–{horarioParaTela(s.fim, fuso).hora}
                </td>
                <td className="py-2 pr-4">{nome(s.servicoId, servicos)}</td>
                <td className="py-2 pr-4">
                  {vagasEmEdicao?.id === s.id ? (
                    <form onSubmit={(e) => salvarVagas(e, s)} className="flex items-end gap-2">
                      <Campo rotulo="Vagas" erro={vagasEmEdicao.erro} dica="vazio = sem limite">
                        <Texto
                          className="w-24"
                          inputMode="numeric"
                          autoFocus
                          valor={vagasEmEdicao.texto}
                          aoMudar={(texto) => setVagasEmEdicao({ id: s.id, texto })}
                        />
                      </Campo>
                      <Button type="submit" size="sm">
                        Salvar
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setVagasEmEdicao(null)}>
                        Voltar
                      </Button>
                    </form>
                  ) : s.vagas === null ? (
                    `${s.ocupadas} / sem limite`
                  ) : (
                    `${s.ocupadas} / ${s.vagas}`
                  )}
                </td>
                <td className="py-2 pr-4">
                  {s.visibilidade === "publica" ? "Pública" : "Privada"}
                  {s.dispensaPreCadastro ? " · sem pré-cadastro" : ""}
                </td>
                <td className="py-2 pr-4">{s.profissional ?? "—"}</td>
                <td className="py-2 pr-4">{s.estado}</td>
                <td className="flex gap-1 py-2">
                  {s.estado === "planejada" || s.estado === "aberta" ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setVagasEmEdicao({ id: s.id, texto: s.vagas === null ? "" : String(s.vagas) })}
                    >
                      Vagas
                    </Button>
                  ) : null}
                  {/* Serviço regulado só tem sessão privada: "tornar pública" seria sempre recusado. */}
                  {(s.estado === "planejada" || s.estado === "aberta") &&
                  (s.visibilidade === "publica" ||
                    visibilidadesPermitidas(servicos.find((x) => x.id === s.servicoId)?.modo ?? "livre").includes(
                      "publica",
                    )) ? (
                    <Button variant="ghost" size="sm" onClick={() => agir(s, "visibilidade")}>
                      {s.visibilidade === "publica" ? "Tornar privada" : "Tornar pública"}
                    </Button>
                  ) : null}
                  {s.estado === "planejada" ? (
                    <Button variant="ghost" size="sm" onClick={() => agir(s, "cancelar")}>
                      Cancelar
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </Tabela>
          {sessoes.itens.length === 0 ? <p className="text-sm text-gray-500">Nenhuma sessão neste dia.</p> : null}
          <Cartao titulo={`Nova sessão em ${dia.split("-").reverse().join("/")}`}>
            <form onSubmit={criar} className="flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <Campo rotulo="Serviço" erro={erros.campos.servicoId}>
                  <Selecao
                    valor={v.servicoId}
                    placeholder="Escolha o serviço"
                    opcoes={servicos.map((s) => ({ valor: s.id, rotulo: s.nome }))}
                    aoMudar={(servicoId) => {
                      const novo = servicos.find((s) => s.id === servicoId);
                      const vis = visibilidadesPermitidas(novo?.modo ?? "livre").includes(v.visibilidade)
                        ? v.visibilidade
                        : "privada";
                      setV({ ...v, servicoId, estacoes: [], ...ajustarVisibilidade(v, vis) });
                    }}
                  />
                </Campo>
                <Campo rotulo="Início" erro={erros.campos.inicio}>
                  <Texto type="time" required valor={v.inicio} aoMudar={(inicio) => setV({ ...v, inicio })} />
                </Campo>
                <Campo rotulo="Fim" erro={erros.campos.fim}>
                  <Texto type="time" required valor={v.fim} aoMudar={(fim) => setV({ ...v, fim })} />
                </Campo>
                <Campo rotulo="Vagas" erro={erros.campos.vagas} dica="vazio = sem limite">
                  <Texto inputMode="numeric" valor={v.vagas} aoMudar={(vagas) => setV({ ...v, vagas })} />
                </Campo>
                <Campo rotulo="Visibilidade" erro={erros.campos.visibilidade}>
                  <Selecao
                    valor={v.visibilidade}
                    aoMudar={(vis) => vis && setV({ ...v, ...ajustarVisibilidade(v, vis as Visibilidade) })}
                    opcoes={permitidas.map((p) => ({
                      valor: p,
                      rotulo: p === "publica" ? "Pública (qualquer paciente pede)" : "Privada (pela lista de espera)",
                    }))}
                  />
                </Campo>
                <Campo rotulo="Profissional" erro={erros.campos.profissional}>
                  <Texto valor={v.profissional} aoMudar={(profissional) => setV({ ...v, profissional })} />
                </Campo>
              </div>
              {v.visibilidade === "publica" ? (
                <Caixa
                  rotulo="Dispensar pré-cadastro"
                  marcada={v.dispensaPreCadastro}
                  aoMudar={(dispensaPreCadastro) => setV({ ...v, dispensaPreCadastro })}
                />
              ) : null}
              <fieldset className="flex flex-col gap-1 text-sm text-gray-700">
                <legend className="mb-1 font-medium">Estações</legend>
                {v.servicoId && estacoesDoServico(estacoes, v.servicoId).length === 0 ? (
                  <span className="text-gray-500">Nenhuma estação atende este serviço.</span>
                ) : null}
                {estacoesDoServico(estacoes, v.servicoId).map((est) => (
                  <Caixa
                    key={est.id}
                    rotulo={est.nome}
                    marcada={v.estacoes.includes(est.id)}
                    aoMudar={(marcada) =>
                      setV({
                        ...v,
                        estacoes: marcada ? [...v.estacoes, est.id] : v.estacoes.filter((x) => x !== est.id),
                      })
                    }
                  />
                ))}
                {erros.campos.estacoes ? <span className="text-xs text-red-700">{erros.campos.estacoes}</span> : null}
              </fieldset>
              <Aviso texto={erros.geral ?? (erros.campos.dispensaPreCadastro || null)} />
              <Button type="submit" className="self-start">
                Criar sessão
              </Button>
            </form>
          </Cartao>
        </>
      ) : null}
    </div>
  );
}
