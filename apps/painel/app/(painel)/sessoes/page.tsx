"use client";

import { type FormEvent, useState } from "react";
import { Aviso, Campo, Cartao, classeDoCampo, Tabela } from "@/components/formulario";
import { SeletorDeUnidade } from "@/components/seletor-de-unidade";
import { Button } from "@/components/ui/button";
import { useApi } from "@/lib/api-context";
import { type ErrosDoEnvio, errosDoEnvio, mensagemDoErro } from "@/lib/formularios/erros";
import {
  ajustarVisibilidade,
  estacoesDoServico,
  hojeNoFuso,
  horarioParaEnvio,
  horarioParaTela,
  intervaloDoDia,
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

export default function Sessoes() {
  const api = useApi();
  const { unidades, atual, escolher, unidade } = useUnidadeAtual();
  const fuso = unidade?.fuso ?? "America/Sao_Paulo";
  const [dia, setDia] = useState(() => hojeNoFuso("America/Sao_Paulo"));
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

  const servico = servicos.find((s) => s.id === v.servicoId);
  const permitidas = visibilidadesPermitidas(servico?.modo ?? "livre");
  const nome = (id: string, lista: { id: string; nome: string }[]) => lista.find((x) => x.id === id)?.nome ?? "?";

  async function criar(e: FormEvent) {
    e.preventDefault();
    try {
      await api.post(`/v1/painel/unidades/${atual}/sessoes`, {
        servicoId: v.servicoId,
        inicio: horarioParaEnvio(dia, v.inicio, fuso),
        fim: horarioParaEnvio(dia, v.fim, fuso),
        vagas: v.vagas.trim() ? Number(v.vagas) : null,
        visibilidade: v.visibilidade,
        dispensaPreCadastro: v.visibilidade === "publica" && v.dispensaPreCadastro,
        profissional: v.profissional.trim() || null,
        estacoes: v.estacoes,
      });
      setErros(SEM_ERROS);
      sessoes.recarregar();
    } catch (err) {
      setErros(errosDoEnvio(err));
    }
  }

  async function agir(s: Sessao, acao: "visibilidade" | "cancelar") {
    const pergunta =
      acao === "cancelar"
        ? "Cancelar esta sessão?"
        : `Tornar esta sessão ${s.visibilidade === "publica" ? "privada" : "pública"}?`;
    if (!window.confirm(pergunta)) return;
    try {
      if (acao === "cancelar") await api.post(`/v1/painel/sessoes/${s.id}/cancelar`, {});
      else
        await api.post(`/v1/painel/sessoes/${s.id}/visibilidade`, {
          visibilidade: s.visibilidade === "publica" ? "privada" : "publica",
          versao: s.versao,
        });
      setAviso(null);
      sessoes.recarregar();
    } catch (err) {
      setAviso(mensagemDoErro(err));
    }
  }

  async function mudarVagas(s: Sessao) {
    const texto = window.prompt("Vagas (vazio = sem limite)", s.vagas === null ? "" : String(s.vagas));
    if (texto === null) return;
    try {
      await api.patch(`/v1/painel/sessoes/${s.id}`, { vagas: texto.trim() ? Number(texto) : null, versao: s.versao });
      setAviso(null);
      sessoes.recarregar();
    } catch (err) {
      setAviso(mensagemDoErro(err));
    }
  }

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <h1 className="text-2xl font-bold text-gray-900">Sessões</h1>
      <div className="flex flex-wrap items-end gap-4">
        <SeletorDeUnidade unidades={unidades} atual={atual} escolher={escolher} />
        <Campo rotulo="Dia">
          <input
            type="date"
            className={classeDoCampo}
            value={dia}
            onChange={(e) => e.target.value && setDia(e.target.value)}
          />
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
                  {s.vagas === null ? `${s.ocupadas} / sem limite` : `${s.ocupadas} / ${s.vagas}`}
                </td>
                <td className="py-2 pr-4">
                  {s.visibilidade === "publica" ? "Pública" : "Privada"}
                  {s.dispensaPreCadastro ? " · sem pré-cadastro" : ""}
                </td>
                <td className="py-2 pr-4">{s.profissional ?? "—"}</td>
                <td className="py-2 pr-4">{s.estado}</td>
                <td className="flex gap-1 py-2">
                  {s.estado === "planejada" ? (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => mudarVagas(s)}>
                        Vagas
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => agir(s, "visibilidade")}>
                        {s.visibilidade === "publica" ? "Tornar privada" : "Tornar pública"}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => agir(s, "cancelar")}>
                        Cancelar
                      </Button>
                    </>
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
                  <select
                    className={classeDoCampo}
                    required
                    value={v.servicoId}
                    onChange={(e) => {
                      const novo = servicos.find((s) => s.id === e.target.value);
                      const vis = visibilidadesPermitidas(novo?.modo ?? "livre").includes(v.visibilidade)
                        ? v.visibilidade
                        : "privada";
                      setV({ ...v, servicoId: e.target.value, estacoes: [], ...ajustarVisibilidade(v, vis) });
                    }}
                  >
                    <option value="">Escolha o serviço</option>
                    {servicos.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nome}
                      </option>
                    ))}
                  </select>
                </Campo>
                <Campo rotulo="Início" erro={erros.campos.inicio}>
                  <input
                    type="time"
                    className={classeDoCampo}
                    required
                    value={v.inicio}
                    onChange={(e) => setV({ ...v, inicio: e.target.value })}
                  />
                </Campo>
                <Campo rotulo="Fim" erro={erros.campos.fim}>
                  <input
                    type="time"
                    className={classeDoCampo}
                    required
                    value={v.fim}
                    onChange={(e) => setV({ ...v, fim: e.target.value })}
                  />
                </Campo>
                <Campo rotulo="Vagas" erro={erros.campos.vagas} dica="vazio = sem limite">
                  <input
                    className={classeDoCampo}
                    inputMode="numeric"
                    value={v.vagas}
                    onChange={(e) => setV({ ...v, vagas: e.target.value })}
                  />
                </Campo>
                <Campo rotulo="Visibilidade">
                  <select
                    className={classeDoCampo}
                    value={v.visibilidade}
                    onChange={(e) => setV({ ...v, ...ajustarVisibilidade(v, e.target.value as Visibilidade) })}
                  >
                    {permitidas.map((p) => (
                      <option key={p} value={p}>
                        {p === "publica" ? "Pública (qualquer paciente pede)" : "Privada (pela lista de espera)"}
                      </option>
                    ))}
                  </select>
                </Campo>
                <Campo rotulo="Profissional">
                  <input
                    className={classeDoCampo}
                    value={v.profissional}
                    onChange={(e) => setV({ ...v, profissional: e.target.value })}
                  />
                </Campo>
              </div>
              {v.visibilidade === "publica" ? (
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={v.dispensaPreCadastro}
                    onChange={(e) => setV({ ...v, dispensaPreCadastro: e.target.checked })}
                  />
                  Dispensar pré-cadastro
                </label>
              ) : null}
              <fieldset className="flex flex-col gap-1 text-sm text-gray-700">
                <legend className="mb-1 font-medium">Estações</legend>
                {v.servicoId && estacoesDoServico(estacoes, v.servicoId).length === 0 ? (
                  <span className="text-gray-500">Nenhuma estação atende este serviço.</span>
                ) : null}
                {estacoesDoServico(estacoes, v.servicoId).map((est) => (
                  <label key={est.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={v.estacoes.includes(est.id)}
                      onChange={(e) =>
                        setV({
                          ...v,
                          estacoes: e.target.checked ? [...v.estacoes, est.id] : v.estacoes.filter((x) => x !== est.id),
                        })
                      }
                    />
                    {est.nome}
                  </label>
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
