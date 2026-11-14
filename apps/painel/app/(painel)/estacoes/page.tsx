"use client";

import { estacaoEntradaSchema } from "@fila-saude/schemas/estacao";
import { type FormEvent, useState } from "react";
import { useConfirmar } from "@/components/dialogos";
import { Aviso, Caixa, Campo, Cartao, Selecao, Tabela, Texto } from "@/components/formulario";
import { SeletorDeUnidade } from "@/components/seletor-de-unidade";
import { Button } from "@/components/ui/button";
import { useApi } from "@/lib/api-context";
import { type ErrosDoEnvio, errosDoEnvio, mensagemDoErro, validarNoCliente } from "@/lib/formularios/erros";
import { servicosParaEtapa } from "@/lib/formularios/estacao";
import { useUnidadeAtual } from "@/lib/unidade-atual";
import { useLista } from "@/lib/use-lista";

type Etapa = "triagem" | "atendimento";
type Estacao = { id: string; nome: string; etapa: Etapa; servicos: string[]; aberta: boolean };
type Servico = { id: string; nome: string; exigeTriagem: boolean };

const SEM_ERROS: ErrosDoEnvio = { geral: null, campos: {} };

export default function Estacoes() {
  const api = useApi();
  const confirmar = useConfirmar();
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
    const invalidos = validarNoCliente(estacaoEntradaSchema, v);
    if (invalidos) return setErros(invalidos);
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
    if (!(await confirmar({ titulo: `Arquivar a estação ${est.nome}?`, acao: "Arquivar", perigo: true }))) return;
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
                  <Texto required valor={v.nome} placeholder="Consultório 1" aoMudar={(nome) => setV({ ...v, nome })} />
                </Campo>
                <Campo rotulo="Etapa" dica="Não muda depois de criada.">
                  <Selecao
                    valor={v.etapa}
                    aoMudar={(etapa) => etapa && setV({ ...v, etapa: etapa as Etapa, servicos: [] })}
                    opcoes={[
                      { valor: "atendimento", rotulo: "Atendimento" },
                      { valor: "triagem", rotulo: "Triagem" },
                    ]}
                  />
                </Campo>
              </div>
              <fieldset className="flex flex-col gap-1 text-sm text-gray-700">
                <legend className="mb-1 font-medium">Serviços atendidos</legend>
                {oferecidos.length === 0 ? (
                  <span className="text-gray-500">Nenhum serviço disponível para esta etapa.</span>
                ) : null}
                {oferecidos.map((s) => (
                  <Caixa
                    key={s.id}
                    rotulo={s.nome}
                    marcada={v.servicos.includes(s.id)}
                    aoMudar={(marcada) =>
                      setV({
                        ...v,
                        servicos: marcada ? [...v.servicos, s.id] : v.servicos.filter((x) => x !== s.id),
                      })
                    }
                  />
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
