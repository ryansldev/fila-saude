"use client";

import { estacaoEdicaoSchema, estacaoEntradaSchema } from "@fila-saude/schemas/estacao";
import { PlusIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useConfirmar } from "@/components/dialogos";
import { Aviso, Campo, Escolha, Marcacoes, PainelLateral, Secao, Tabela, Texto } from "@/components/formulario";
import { AcoesDaLinha, CabecalhoDaPagina } from "@/components/pagina";
import { SeletorDeUnidade } from "@/components/seletor-de-unidade";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { useApi } from "@/lib/api-context";
import { type ErrosDoEnvio, errosDoEnvio, mensagemDoErro, validarNoCliente } from "@/lib/formularios/erros";
import { servicosParaEtapa } from "@/lib/formularios/estacao";
import { useUnidadeAtual } from "@/lib/unidade-atual";
import { useLista } from "@/lib/use-lista";

type Etapa = "triagem" | "atendimento";
type Estacao = { id: string; nome: string; etapa: Etapa; servicos: string[]; aberta: boolean };
type Servico = { id: string; nome: string; prefixo: string; exigeTriagem: boolean };
type ValoresEstacao = { nome: string; etapa: Etapa; servicos: string[] };

const VAZIO: ValoresEstacao = { nome: "", etapa: "atendimento", servicos: [] };
const SEM_ERROS: ErrosDoEnvio = { geral: null, campos: {} };

const ETAPAS: Record<Etapa, { rotulo: string; descricao: string }> = {
  triagem: { rotulo: "Triagem", descricao: "Acolhimento e classificação de risco pelo enfermeiro" },
  atendimento: { rotulo: "Atendimento", descricao: "Consulta, curativo, procedimento" },
};

/** Cadastro (com etapa) ou edição (nome e serviços; a etapa não muda depois de criada). */
function PainelDaEstacao({
  aberto,
  aoFechar,
  titulo,
  acao,
  inicial,
  editando,
  servicos,
  enviar,
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  acao: string;
  inicial: ValoresEstacao;
  /** Na edição a etapa fica travada e só vai o que mudou. */
  editando: boolean;
  servicos: Servico[];
  enviar: (v: ValoresEstacao) => Promise<void>;
}) {
  const [v, setV] = useState(inicial);
  const [erros, setErros] = useState(SEM_ERROS);
  const [enviando, setEnviando] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: só ao abrir.
  useEffect(() => {
    if (aberto) {
      setV(inicial);
      setErros(SEM_ERROS);
    }
  }, [aberto]);

  const oferecidos = servicosParaEtapa(servicos, v.etapa);

  async function aoEnviar() {
    setEnviando(true);
    try {
      await enviar(v);
      aoFechar();
    } catch (err) {
      setErros(err instanceof ErrosLocais ? err.erros : errosDoEnvio(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <PainelLateral
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={titulo}
      descricao="Uma sala ou consultório que chama pacientes no painel e na TV."
      aoEnviar={aoEnviar}
      acao={acao}
      enviando={enviando}
    >
      <Secao titulo="Identificação" descricao="O nome aparece na TV quando a estação chama alguém.">
        <Campo rotulo="Nome" erro={erros.campos.nome}>
          <Texto required placeholder="Ex.: Consultório 3" valor={v.nome} aoMudar={(nome) => setV({ ...v, nome })} />
        </Campo>
      </Secao>
      <Secao titulo="Etapa" descricao="Não muda depois de criada.">
        <Escolha
          valor={v.etapa}
          aoMudar={(etapa) => {
            const nova = etapa as Etapa;
            const permitidos = servicosParaEtapa(servicos, nova).map((s) => s.id);
            setV({ ...v, etapa: nova, servicos: v.servicos.filter((id) => permitidos.includes(id)) });
          }}
          opcoes={(Object.keys(ETAPAS) as Etapa[]).map((e) => ({
            valor: e,
            ...ETAPAS[e],
            desativada: editando && e !== v.etapa,
          }))}
        />
        {erros.campos.etapa ? <p className="text-sm text-destructive">{erros.campos.etapa}</p> : null}
      </Secao>
      <Secao
        titulo="Serviços que esta estação chama"
        descricao={v.etapa === "triagem" ? "Só aparecem os serviços que passam pela triagem." : undefined}
      >
        <Marcacoes
          valores={v.servicos}
          aoMudar={(marcados) => setV({ ...v, servicos: marcados })}
          opcoes={oferecidos.map((s) => ({ valor: s.id, rotulo: s.nome, descricao: `Senha ${s.prefixo}` }))}
          vazio={
            v.etapa === "triagem"
              ? "Nenhum serviço desta unidade passa pela triagem."
              : "Nenhum serviço nesta unidade. Cadastre um em Serviços."
          }
        />
        {erros.campos.servicos ? <p className="text-sm text-destructive">{erros.campos.servicos}</p> : null}
      </Secao>
      <Aviso texto={erros.geral} />
    </PainelLateral>
  );
}

/** Erro de validação no cliente, levado do `enviar` até o painel para marcar os campos. */
class ErrosLocais extends Error {
  constructor(readonly erros: ErrosDoEnvio) {
    super("validação");
  }
}

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
  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<Estacao | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const nomeDoServico = (id: string) => servicos.find((s) => s.id === id)?.nome ?? "?";

  async function arquivar(est: Estacao) {
    if (!(await confirmar({ titulo: `Arquivar a estação ${est.nome}?`, acao: "Arquivar", perigo: true }))) return;
    try {
      await api.del(`/v1/painel/estacoes/${est.id}`);
      setAviso(null);
      setOk(`Estação ${est.nome} arquivada.`);
      estacoes.recarregar();
    } catch (err) {
      setAviso(mensagemDoErro(err));
    }
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <CabecalhoDaPagina
        titulo="Estações"
        descricao="Salas e consultórios que chamam pacientes, e os serviços que cada uma atende."
        acoes={
          atual ? (
            <Button onClick={() => setCriando(true)}>
              <PlusIcon data-icon="inline-start" strokeWidth={2.75} />
              Adicionar estação
            </Button>
          ) : null
        }
      />
      <SeletorDeUnidade unidades={unidades} atual={atual} escolher={escolher} erro={erroDasUnidades} />
      <Aviso texto={estacoes.erro ?? aviso} />
      <Aviso texto={ok} tipo="ok" />
      {atual ? (
        <Tabela cabecalho={["Nome", "Etapa", "Serviços", ""]}>
          {estacoes.itens.map((est) => (
            <TableRow key={est.id}>
              <TableCell className="font-semibold text-slate-900">{est.nome}</TableCell>
              <TableCell>{ETAPAS[est.etapa].rotulo}</TableCell>
              <TableCell className="whitespace-normal">{est.servicos.map(nomeDoServico).join(", ") || "—"}</TableCell>
              <TableCell>
                <AcoesDaLinha
                  excluir={{ rotulo: `Arquivar ${est.nome}`, aoClicar: () => arquivar(est) }}
                  editar={{ rotulo: `Editar ${est.nome}`, aoClicar: () => setEditando(est) }}
                />
              </TableCell>
            </TableRow>
          ))}
          {estacoes.itens.length === 0 && !estacoes.erro ? (
            <TableRow>
              <TableCell colSpan={4} className="py-8 text-center text-slate-500">
                Nenhuma estação nesta unidade. Use "Adicionar estação".
              </TableCell>
            </TableRow>
          ) : null}
        </Tabela>
      ) : null}
      <PainelDaEstacao
        aberto={criando}
        aoFechar={() => setCriando(false)}
        titulo="Adicionar estação"
        acao="Criar estação"
        inicial={VAZIO}
        editando={false}
        servicos={servicos}
        enviar={async (v) => {
          const invalidos = validarNoCliente(estacaoEntradaSchema, v);
          if (invalidos) throw new ErrosLocais(invalidos);
          await api.post(`/v1/painel/unidades/${atual}/estacoes`, v);
          setOk(`Estação ${v.nome.trim()} criada.`);
          estacoes.recarregar();
        }}
      />
      <PainelDaEstacao
        aberto={editando !== null}
        aoFechar={() => setEditando(null)}
        titulo={`Editar ${editando?.nome ?? "estação"}`}
        acao="Salvar"
        inicial={editando ? { nome: editando.nome, etapa: editando.etapa, servicos: editando.servicos } : VAZIO}
        editando
        servicos={servicos}
        enviar={async (v) => {
          if (!editando) return;
          // Só vai o que mudou (o schema da edição é estrito e parcial).
          const corpo: { nome?: string; servicos?: string[] } = {};
          if (v.nome !== editando.nome) corpo.nome = v.nome;
          const mesmos =
            v.servicos.length === editando.servicos.length && v.servicos.every((id) => editando.servicos.includes(id));
          if (!mesmos) corpo.servicos = v.servicos;
          if (Object.keys(corpo).length === 0) return;
          const invalidos = validarNoCliente(estacaoEdicaoSchema, corpo);
          if (invalidos) throw new ErrosLocais(invalidos);
          await api.patch(`/v1/painel/estacoes/${editando.id}`, corpo);
          setOk(`Estação ${v.nome.trim()} salva.`);
          estacoes.recarregar();
        }}
      />
    </div>
  );
}
