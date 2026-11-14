"use client";

import { type FormEvent, useState } from "react";
import { Aviso, Campo, Cartao, classeDoCampo, Tabela } from "@/components/formulario";
import { SeletorDeUnidade } from "@/components/seletor-de-unidade";
import { Button } from "@/components/ui/button";
import { useApi } from "@/lib/api-context";
import { type ErrosDoEnvio, errosDoEnvio, mensagemDoErro } from "@/lib/formularios/erros";
import { servicosParaEtapa } from "@/lib/formularios/estacao";
import { useUnidadeAtual } from "@/lib/unidade-atual";
import { useLista } from "@/lib/use-lista";

type Etapa = "triagem" | "atendimento";
type Estacao = { id: string; nome: string; etapa: Etapa; servicos: string[]; aberta: boolean };
type Servico = { id: string; nome: string; exigeTriagem: boolean };

const SEM_ERROS: ErrosDoEnvio = { geral: null, campos: {} };

export default function Estacoes() {
  const api = useApi();
  const {
    unidades,
    atual,
    escolher,
    erro: erroDasUnidades,
  } = useUnidadeAtual(["configurar_servicos_sessoes_estacoes_tv"]);
  const estacoes = useLista<Estacao>(atual ? `/v1/painel/unidades/${atual}/estacoes` : null);
  const { itens: servicos } = useLista<Servico>(atual ? `/v1/painel/unidades/${atual}/servicos` : null);
  const [v, setV] = useState<{ nome: string; etapa: Etapa; servicos: string[] }>({
    nome: "",
    etapa: "atendimento",
    servicos: [],
  });
  const [erros, setErros] = useState(SEM_ERROS);
  const [aviso, setAviso] = useState<string | null>(null);

  const oferecidos = servicosParaEtapa(servicos, v.etapa);
  const nomeDoServico = (id: string) => servicos.find((s) => s.id === id)?.nome ?? "?";

  async function criar(e: FormEvent) {
    e.preventDefault();
    try {
      await api.post(`/v1/painel/unidades/${atual}/estacoes`, v);
      setErros(SEM_ERROS);
      setV({ nome: "", etapa: v.etapa, servicos: [] });
      estacoes.recarregar();
    } catch (err) {
      setErros(errosDoEnvio(err));
    }
  }

  async function arquivar(est: Estacao) {
    if (!window.confirm(`Arquivar a estação ${est.nome}?`)) return;
    try {
      await api.del(`/v1/painel/estacoes/${est.id}`);
      setAviso(null);
      estacoes.recarregar();
    } catch (err) {
      setAviso(mensagemDoErro(err));
    }
  }

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <h1 className="text-2xl font-bold text-gray-900">Estações</h1>
      <SeletorDeUnidade unidades={unidades} atual={atual} escolher={escolher} erro={erroDasUnidades} />
      <Aviso texto={estacoes.erro ?? aviso} />
      {atual ? (
        <>
          <Tabela cabecalho={["Nome", "Etapa", "Serviços", ""]}>
            {estacoes.itens.map((est) => (
              <tr key={est.id}>
                <td className="py-2 pr-4 font-medium">{est.nome}</td>
                <td className="py-2 pr-4">{est.etapa === "triagem" ? "Triagem" : "Atendimento"}</td>
                <td className="py-2 pr-4">{est.servicos.map(nomeDoServico).join(", ")}</td>
                <td className="py-2">
                  <Button variant="ghost" size="sm" onClick={() => arquivar(est)}>
                    Arquivar
                  </Button>
                </td>
              </tr>
            ))}
          </Tabela>
          <Cartao titulo="Nova estação">
            <form onSubmit={criar} className="flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo rotulo="Nome" erro={erros.campos.nome}>
                  <input
                    className={classeDoCampo}
                    required
                    value={v.nome}
                    placeholder="Consultório 1"
                    onChange={(e) => setV({ ...v, nome: e.target.value })}
                  />
                </Campo>
                <Campo rotulo="Etapa" dica="Não muda depois de criada.">
                  <select
                    className={classeDoCampo}
                    value={v.etapa}
                    onChange={(e) => setV({ ...v, etapa: e.target.value as Etapa, servicos: [] })}
                  >
                    <option value="atendimento">Atendimento</option>
                    <option value="triagem">Triagem</option>
                  </select>
                </Campo>
              </div>
              <fieldset className="flex flex-col gap-1 text-sm text-gray-700">
                <legend className="mb-1 font-medium">Serviços atendidos</legend>
                {oferecidos.length === 0 ? (
                  <span className="text-gray-500">Nenhum serviço disponível para esta etapa.</span>
                ) : null}
                {oferecidos.map((s) => (
                  <label key={s.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={v.servicos.includes(s.id)}
                      onChange={(e) =>
                        setV({
                          ...v,
                          servicos: e.target.checked ? [...v.servicos, s.id] : v.servicos.filter((x) => x !== s.id),
                        })
                      }
                    />
                    {s.nome}
                  </label>
                ))}
                {erros.campos.servicos ? <span className="text-xs text-red-700">{erros.campos.servicos}</span> : null}
              </fieldset>
              <Aviso texto={erros.geral} />
              <Button type="submit" className="self-start">
                Criar estação
              </Button>
            </form>
          </Cartao>
        </>
      ) : null}
    </div>
  );
}
