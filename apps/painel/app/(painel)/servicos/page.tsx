"use client";

import { servicoEdicaoSchema, servicoEntradaSchema } from "@fila-saude/schemas/servico";
import { type FormEvent, useState } from "react";
import type { ZodType } from "zod";
import { Aviso, Caixa, Campo, Cartao, Selecao, Tabela, Texto } from "@/components/formulario";
import { SeletorDeUnidade } from "@/components/seletor-de-unidade";
import { Button } from "@/components/ui/button";
import { useApi } from "@/lib/api-context";
import { type ErrosDoEnvio, errosDoEnvio, validarNoCliente } from "@/lib/formularios/erros";
import {
  type Modo,
  mostraTempoTriagem,
  ROTULOS_MODO,
  servicoParaEnvio,
  type ValoresServico,
} from "@/lib/formularios/servico";
import { useUnidadeAtual } from "@/lib/unidade-atual";
import { useLista } from "@/lib/use-lista";

type Servico = {
  id: string;
  nome: string;
  prefixo: string;
  exigeTriagem: boolean;
  modo: Modo;
  tempoMedioMin: { triagem?: number; atendimento?: number };
};

const VAZIO: ValoresServico = {
  nome: "",
  prefixo: "",
  exigeTriagem: false,
  modo: "livre",
  triagem: "5",
  atendimento: "15",
};
const SEM_ERROS: ErrosDoEnvio = { geral: null, campos: {} };
const OPCOES_MODO = (Object.keys(ROTULOS_MODO) as Modo[]).map((m) => ({ valor: m, rotulo: ROTULOS_MODO[m] }));
const ERRO_MINUTOS = "Use um número inteiro de minutos.";

/** Minutos digitados: vazio vale (não vai), senão só dígitos; assim nunca vai NaN para a API. */
function problemasDosMinutos(v: ValoresServico): Record<string, string> {
  const invalido = (t: string) => t.trim() !== "" && !/^\d+$/.test(t.trim());
  const campos: Record<string, string> = {};
  if (mostraTempoTriagem(v.exigeTriagem) && invalido(v.triagem)) campos["tempoMedioMin.triagem"] = ERRO_MINUTOS;
  if (invalido(v.atendimento)) campos["tempoMedioMin.atendimento"] = ERRO_MINUTOS;
  return campos;
}

function deServico(s: Servico): ValoresServico {
  return {
    nome: s.nome,
    prefixo: s.prefixo,
    exigeTriagem: s.exigeTriagem,
    modo: s.modo,
    triagem: String(s.tempoMedioMin.triagem ?? ""),
    atendimento: String(s.tempoMedioMin.atendimento ?? ""),
  };
}

function FormularioDeServico({
  inicial,
  enviar,
  rotulo,
  schema,
  aoCancelar,
}: {
  inicial: ValoresServico;
  enviar: (v: ValoresServico) => Promise<void>;
  rotulo: string;
  /** O mesmo schema da rota da API que recebe o envio. */
  schema: ZodType;
  aoCancelar?: () => void;
}) {
  const [v, setV] = useState(inicial);
  const [erros, setErros] = useState(SEM_ERROS);

  async function aoEnviar(e: FormEvent) {
    e.preventDefault();
    const minutos = problemasDosMinutos(v);
    if (Object.keys(minutos).length > 0) return setErros({ geral: null, campos: minutos });
    const invalidos = validarNoCliente(schema, servicoParaEnvio(v));
    if (invalidos) return setErros(invalidos);
    try {
      await enviar(v);
      setErros(SEM_ERROS);
      if (!aoCancelar) setV(VAZIO);
    } catch (err) {
      setErros(errosDoEnvio(err));
    }
  }

  return (
    <form onSubmit={aoEnviar} className="grid gap-3 sm:grid-cols-2">
      <Campo rotulo="Nome" erro={erros.campos.nome}>
        <Texto required valor={v.nome} aoMudar={(nome) => setV({ ...v, nome })} />
      </Campo>
      <Campo rotulo="Prefixo da senha" erro={erros.campos.prefixo} dica="1 a 3 letras (ex.: C → C001)">
        <Texto
          required
          maxLength={3}
          valor={v.prefixo}
          mascara={(t) => t.toUpperCase()}
          aoMudar={(prefixo) => setV({ ...v, prefixo })}
        />
      </Campo>
      <Campo rotulo="Como é marcado" erro={erros.campos.modo}>
        <Selecao valor={v.modo} opcoes={OPCOES_MODO} aoMudar={(modo) => setV({ ...v, modo: modo as Modo })} />
      </Campo>
      <div className="self-end pb-2">
        <Caixa
          rotulo="Exige triagem"
          marcada={v.exigeTriagem}
          aoMudar={(exigeTriagem) => setV({ ...v, exigeTriagem })}
        />
      </div>
      {mostraTempoTriagem(v.exigeTriagem) ? (
        <Campo rotulo="Tempo médio da triagem (min)" erro={erros.campos["tempoMedioMin.triagem"]}>
          <Texto inputMode="numeric" valor={v.triagem} aoMudar={(triagem) => setV({ ...v, triagem })} />
        </Campo>
      ) : null}
      <Campo rotulo="Tempo médio do atendimento (min)" erro={erros.campos["tempoMedioMin.atendimento"]}>
        <Texto inputMode="numeric" valor={v.atendimento} aoMudar={(atendimento) => setV({ ...v, atendimento })} />
      </Campo>
      <div className="flex flex-col gap-2 sm:col-span-2">
        <Aviso texto={erros.geral} />
        <div className="flex gap-2">
          <Button type="submit">{rotulo}</Button>
          {aoCancelar ? (
            <Button type="button" variant="ghost" onClick={aoCancelar}>
              Cancelar
            </Button>
          ) : null}
        </div>
      </div>
    </form>
  );
}

export default function Servicos() {
  const api = useApi();
  const {
    unidades,
    atual,
    escolher,
    erro: erroDasUnidades,
  } = useUnidadeAtual(["configurar_servicos_sessoes_estacoes_tv"]);
  const { itens, erro, recarregar } = useLista<Servico>(atual ? `/v1/painel/unidades/${atual}/servicos` : null);
  const [editando, setEditando] = useState<Servico | null>(null);

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <h1 className="text-2xl font-bold text-gray-900">Serviços</h1>
      <SeletorDeUnidade unidades={unidades} atual={atual} escolher={escolher} erro={erroDasUnidades} />
      <Aviso texto={erro} />
      {atual ? (
        <>
          <Tabela cabecalho={["Prefixo", "Nome", "Triagem", "Marcação", "Tempo médio", ""]}>
            {itens.map((s) => (
              <tr key={s.id}>
                <td className="py-2 pr-4 font-mono font-semibold">{s.prefixo}</td>
                <td className="py-2 pr-4 font-medium">{s.nome}</td>
                <td className="py-2 pr-4">{s.exigeTriagem ? "Sim" : "Não"}</td>
                <td className="py-2 pr-4">{s.modo}</td>
                <td className="py-2 pr-4">
                  {s.tempoMedioMin.triagem ? `${s.tempoMedioMin.triagem} + ` : ""}
                  {s.tempoMedioMin.atendimento} min
                </td>
                <td className="py-2">
                  <Button variant="ghost" size="sm" onClick={() => setEditando(s)}>
                    Editar
                  </Button>
                </td>
              </tr>
            ))}
          </Tabela>
          {editando ? (
            <Cartao titulo={`Editar ${editando.nome}`}>
              <FormularioDeServico
                key={editando.id}
                inicial={deServico(editando)}
                rotulo="Salvar"
                schema={servicoEdicaoSchema}
                aoCancelar={() => setEditando(null)}
                enviar={async (v) => {
                  await api.patch(`/v1/painel/servicos/${editando.id}`, servicoParaEnvio(v));
                  setEditando(null);
                  recarregar();
                }}
              />
            </Cartao>
          ) : null}
          <Cartao titulo="Novo serviço">
            <FormularioDeServico
              inicial={VAZIO}
              rotulo="Criar serviço"
              schema={servicoEntradaSchema}
              enviar={async (v) => {
                await api.post(`/v1/painel/unidades/${atual}/servicos`, servicoParaEnvio(v));
                recarregar();
              }}
            />
          </Cartao>
        </>
      ) : null}
    </div>
  );
}
