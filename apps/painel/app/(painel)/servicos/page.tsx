"use client";

import { servicoEdicaoSchema, servicoEntradaSchema } from "@fila-saude/schemas/servico";
import { PlusIcon } from "lucide-react";
import { useEffect, useState } from "react";
import type { ZodType } from "zod";
import {
  Aviso,
  Campo,
  Escolha,
  Interruptor,
  Numero,
  PainelLateral,
  Secao,
  Tabela,
  Texto,
} from "@/components/formulario";
import { AcoesDaLinha, CabecalhoDaPagina } from "@/components/pagina";
import { SeletorDeUnidade } from "@/components/seletor-de-unidade";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { useApi } from "@/lib/api-context";
import { type ErrosDoEnvio, errosDoEnvio, validarNoCliente } from "@/lib/formularios/erros";
import { type Modo, mostraTempoTriagem, servicoParaEnvio, type ValoresServico } from "@/lib/formularios/servico";
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

const DESCRICAO_DO_MODO: Record<Modo, { rotulo: string; descricao: string }> = {
  livre: { rotulo: "Livre", descricao: "O paciente entra na lista de espera pelo app ou pela recepção." },
  requisicao: { rotulo: "Com requisição", descricao: "Precisa de pedido médico, conferido pela unidade." },
  regulado: { rotulo: "Regulado", descricao: "A vaga vem da central de regulação; não aparece na agenda do app." },
};

/** Cadastro ou edição de um serviço, num painel lateral em três seções. */
function PainelDoServico({
  aberto,
  aoFechar,
  titulo,
  acao,
  inicial,
  schema,
  enviar,
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  acao: string;
  inicial: ValoresServico;
  /** O mesmo schema da rota da API que recebe o envio. */
  schema: ZodType;
  enviar: (v: ValoresServico) => Promise<void>;
}) {
  const [v, setV] = useState(inicial);
  const [erros, setErros] = useState(SEM_ERROS);
  const [enviando, setEnviando] = useState(false);
  // Reabriu (outro serviço ou novo cadastro): começa do valor inicial, sem erros antigos.
  // biome-ignore lint/correctness/useExhaustiveDependencies: só ao abrir.
  useEffect(() => {
    if (aberto) {
      setV(inicial);
      setErros(SEM_ERROS);
    }
  }, [aberto]);

  async function aoEnviar() {
    const minutos = problemasDosMinutos(v);
    if (Object.keys(minutos).length > 0) return setErros({ geral: null, campos: minutos });
    const invalidos = validarNoCliente(schema, servicoParaEnvio(v));
    if (invalidos) return setErros(invalidos);
    setEnviando(true);
    try {
      await enviar(v);
      aoFechar();
    } catch (err) {
      setErros(errosDoEnvio(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <PainelLateral
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={titulo}
      descricao="O que a unidade atende e como a fila desse serviço funciona."
      aoEnviar={aoEnviar}
      acao={acao}
      enviando={enviando}
    >
      <Secao titulo="Identificação" descricao="Como o serviço aparece no app, no painel e na senha da TV.">
        <Campo rotulo="Nome" erro={erros.campos.nome}>
          <Texto required placeholder="Ex.: Clínico geral" valor={v.nome} aoMudar={(nome) => setV({ ...v, nome })} />
        </Campo>
        <Campo
          rotulo="Prefixo da senha"
          erro={erros.campos.prefixo}
          dica={`1 a 3 letras. A senha fica ${v.prefixo || "C"}-001.`}
          className="sm:w-80"
        >
          <Texto
            required
            maxLength={3}
            placeholder="C"
            valor={v.prefixo}
            mascara={(t) => t.toUpperCase().replace(/[^A-Z]/g, "")}
            aoMudar={(prefixo) => setV({ ...v, prefixo })}
          />
        </Campo>
      </Secao>
      <Secao titulo="Como o paciente consegue a vaga">
        <Escolha
          colunas={1}
          valor={v.modo}
          aoMudar={(modo) => setV({ ...v, modo: modo as Modo })}
          opcoes={(Object.keys(DESCRICAO_DO_MODO) as Modo[]).map((m) => ({ valor: m, ...DESCRICAO_DO_MODO[m] }))}
        />
        {erros.campos.modo ? <p className="text-sm text-destructive">{erros.campos.modo}</p> : null}
      </Secao>
      <Secao
        titulo="Atendimento"
        descricao="O tempo médio é o ponto de partida da previsão no app; depois o sistema aprende com o dia."
      >
        <Interruptor
          rotulo="Passa pela triagem"
          descricao="O enfermeiro chama primeiro e classifica o risco; depois o paciente vai para o atendimento."
          marcado={v.exigeTriagem}
          aoMudar={(exigeTriagem) => setV({ ...v, exigeTriagem })}
        />
        <div className="flex flex-wrap gap-4">
          {mostraTempoTriagem(v.exigeTriagem) ? (
            <Campo rotulo="Tempo médio da triagem" erro={erros.campos["tempoMedioMin.triagem"]} className="w-auto">
              <Numero sufixo="min" valor={v.triagem} aoMudar={(triagem) => setV({ ...v, triagem })} maxDigitos={3} />
            </Campo>
          ) : null}
          <Campo
            rotulo="Tempo médio do atendimento"
            erro={erros.campos["tempoMedioMin.atendimento"]}
            className="w-auto"
          >
            <Numero
              sufixo="min"
              valor={v.atendimento}
              aoMudar={(atendimento) => setV({ ...v, atendimento })}
              maxDigitos={3}
            />
          </Campo>
        </div>
      </Secao>
      <Aviso texto={erros.geral} />
    </PainelLateral>
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
  const [criando, setCriando] = useState(false);
  const [ok, setOk] = useState<string | null>(null);

  return (
    <div className="flex w-full flex-col gap-6">
      <CabecalhoDaPagina
        titulo="Serviços"
        descricao="O que cada unidade atende, com o prefixo da senha e o tempo médio de atendimento."
        acoes={
          atual ? (
            <Button onClick={() => setCriando(true)}>
              <PlusIcon data-icon="inline-start" strokeWidth={2.75} />
              Adicionar serviço
            </Button>
          ) : null
        }
      />
      <SeletorDeUnidade unidades={unidades} atual={atual} escolher={escolher} erro={erroDasUnidades} />
      <Aviso texto={erro} />
      <Aviso texto={ok} tipo="ok" />
      {atual ? (
        <Tabela cabecalho={["Senha", "Nome", "Marcação", "Triagem", "Tempo médio", ""]}>
          {itens.map((s) => (
            <TableRow key={s.id}>
              <TableCell>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono font-bold text-slate-700">
                  {s.prefixo}
                </span>
              </TableCell>
              <TableCell className="font-semibold text-slate-900">{s.nome}</TableCell>
              <TableCell>{DESCRICAO_DO_MODO[s.modo].rotulo}</TableCell>
              <TableCell>{s.exigeTriagem ? "Sim" : "Não"}</TableCell>
              <TableCell>
                {s.tempoMedioMin.triagem ? `${s.tempoMedioMin.triagem} min + ` : ""}
                {s.tempoMedioMin.atendimento} min
              </TableCell>
              <TableCell>
                <AcoesDaLinha editar={{ rotulo: `Editar ${s.nome}`, aoClicar: () => setEditando(s) }} />
              </TableCell>
            </TableRow>
          ))}
          {itens.length === 0 && !erro ? (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-slate-500">
                Nenhum serviço nesta unidade. Use "Adicionar serviço".
              </TableCell>
            </TableRow>
          ) : null}
        </Tabela>
      ) : null}
      <PainelDoServico
        aberto={criando}
        aoFechar={() => setCriando(false)}
        titulo="Adicionar serviço"
        acao="Criar serviço"
        inicial={VAZIO}
        schema={servicoEntradaSchema}
        enviar={async (v) => {
          await api.post(`/v1/painel/unidades/${atual}/servicos`, servicoParaEnvio(v));
          setOk(`Serviço ${v.nome.trim()} criado.`);
          recarregar();
        }}
      />
      <PainelDoServico
        aberto={editando !== null}
        aoFechar={() => setEditando(null)}
        titulo={`Editar ${editando?.nome ?? "serviço"}`}
        acao="Salvar"
        inicial={editando ? deServico(editando) : VAZIO}
        schema={servicoEdicaoSchema}
        enviar={async (v) => {
          if (!editando) return;
          await api.patch(`/v1/painel/servicos/${editando.id}`, servicoParaEnvio(v));
          setOk(`Serviço ${v.nome.trim()} salvo.`);
          recarregar();
        }}
      />
    </div>
  );
}
