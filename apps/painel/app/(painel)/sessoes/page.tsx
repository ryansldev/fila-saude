"use client";

import { sessaoEdicaoSchema, sessaoEntradaSchema, visibilidadeEntradaSchema } from "@fila-saude/schemas/sessao";
import { PlusIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useConfirmar } from "@/components/dialogos";
import {
  Aviso,
  Campo,
  Escolha,
  Interruptor,
  Marcacoes,
  Numero,
  PainelLateral,
  Secao,
  Selecao,
  Tabela,
  Texto,
} from "@/components/formulario";
import { AcoesDaLinha, CabecalhoDaPagina, EstadoDaSessao } from "@/components/pagina";
import { SeletorDeUnidade } from "@/components/seletor-de-unidade";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
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
type Estacao = { id: string; nome: string; etapa: "triagem" | "atendimento"; servicos: string[] };

const SEM_ERROS: ErrosDoEnvio = { geral: null, campos: {} };

/** Horário digitado → ISO; vazio ou inválido vira "" para o schema apontar o campo. */
function horarioOuVazio(data: string, hora: string, fuso: string): string {
  try {
    return horarioParaEnvio(data, hora, fuso);
  } catch {
    return "";
  }
}

/** Vagas do formulário: "sem limite" ligado vale null; desligado precisa de um inteiro ≥ 1. */
function vagasDoFormulario(
  semLimite: boolean,
  texto: string,
): { ok: true; vagas: number | null } | { ok: false; erro: string } {
  if (semLimite) return { ok: true, vagas: null };
  if (!texto.trim()) return { ok: false, erro: 'Informe quantas vagas, ou ligue "Sem limite de vagas".' };
  const lidas = lerVagas(texto);
  return lidas.ok ? lidas : { ok: false, erro: "Use 1 vaga ou mais." };
}

const VISIBILIDADES: Record<Visibilidade, { rotulo: string; descricao: string }> = {
  publica: { rotulo: "Pública", descricao: "Aparece na agenda do app; qualquer pessoa se inscreve" },
  privada: { rotulo: "Privada", descricao: "Só pela lista de espera da unidade" },
};

function opcoesDeVisibilidade(permitidas: Visibilidade[]) {
  return (Object.keys(VISIBILIDADES) as Visibilidade[]).map((p) => ({
    valor: p,
    ...VISIBILIDADES[p],
    desativada: !permitidas.includes(p),
  }));
}

const DICA_DO_REGULADO = "Serviço regulado: a vaga vem da central de regulação, então a sessão é sempre privada.";

/** "Sem limite de vagas" e, desligado, o número de vagas. */
function CampoDeVagas({
  semLimite,
  vagas,
  erro,
  aoMudar,
}: {
  semLimite: boolean;
  vagas: string;
  erro?: string | undefined;
  aoMudar: (m: { semLimite: boolean; vagas: string }) => void;
}) {
  return (
    <>
      <Interruptor
        rotulo="Sem limite de vagas"
        descricao="A sessão aceita pacientes até o fim do horário."
        marcado={semLimite}
        aoMudar={(marcado) => aoMudar({ semLimite: marcado, vagas })}
      />
      {semLimite ? (
        erro ? (
          <p className="text-sm text-destructive">{erro}</p>
        ) : null
      ) : (
        <Campo rotulo="Quantidade" erro={erro} className="w-auto">
          <Numero sufixo="vagas" valor={vagas} aoMudar={(texto) => aoMudar({ semLimite, vagas: texto })} />
        </Campo>
      )}
    </>
  );
}

type ValoresNova = {
  servicoId: string;
  inicio: string;
  fim: string;
  semLimite: boolean;
  vagas: string;
  visibilidade: Visibilidade;
  dispensaPreCadastro: boolean;
  profissional: string;
  estacoes: string[];
};

const NOVA: ValoresNova = {
  servicoId: "",
  inicio: "08:00",
  fim: "12:00",
  semLimite: true,
  vagas: "",
  visibilidade: "privada",
  dispensaPreCadastro: false,
  profissional: "",
  estacoes: [],
};

function PainelNovaSessao({
  aberto,
  aoFechar,
  dia,
  fuso,
  servicos,
  estacoes,
  enviar,
}: {
  aberto: boolean;
  aoFechar: () => void;
  dia: string;
  fuso: string;
  servicos: Servico[];
  estacoes: Estacao[];
  enviar: (corpo: unknown) => Promise<void>;
}) {
  const [v, setV] = useState(NOVA);
  const [erros, setErros] = useState(SEM_ERROS);
  const [enviando, setEnviando] = useState(false);
  useEffect(() => {
    if (aberto) {
      setV(NOVA);
      setErros(SEM_ERROS);
    }
  }, [aberto]);

  const servico = servicos.find((s) => s.id === v.servicoId);
  const permitidas = visibilidadesPermitidas(servico?.modo ?? "livre");
  const daSessao = estacoesDoServico(estacoes, v.servicoId);

  async function aoEnviar() {
    const vagas = vagasDoFormulario(v.semLimite, v.vagas);
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
    setEnviando(true);
    try {
      await enviar(corpo);
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
      titulo={`Nova sessão em ${dia.split("-").reverse().join("/")}`}
      descricao="Um horário de atendimento de um serviço, com as vagas e quem pode se inscrever."
      aoEnviar={aoEnviar}
      acao="Criar sessão"
      enviando={enviando}
    >
      <Secao titulo="Serviço e horário">
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
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Início" erro={erros.campos.inicio}>
            <Texto type="time" required valor={v.inicio} aoMudar={(inicio) => setV({ ...v, inicio })} />
          </Campo>
          <Campo rotulo="Fim" erro={erros.campos.fim}>
            <Texto type="time" required valor={v.fim} aoMudar={(fim) => setV({ ...v, fim })} />
          </Campo>
        </div>
      </Secao>
      <Secao titulo="Vagas">
        <CampoDeVagas
          semLimite={v.semLimite}
          vagas={v.vagas}
          erro={erros.campos.vagas}
          aoMudar={(m) => setV({ ...v, ...m })}
        />
      </Secao>
      <Secao titulo="Quem vê esta sessão" descricao={permitidas.includes("publica") ? undefined : DICA_DO_REGULADO}>
        <Escolha
          valor={v.visibilidade}
          aoMudar={(vis) => setV({ ...v, ...ajustarVisibilidade(v, vis as Visibilidade) })}
          opcoes={opcoesDeVisibilidade(permitidas)}
        />
        {erros.campos.visibilidade ? <p className="text-sm text-destructive">{erros.campos.visibilidade}</p> : null}
        {v.visibilidade === "publica" ? (
          <Interruptor
            rotulo="Dispensar pré-cadastro"
            descricao="O paciente se inscreve sem ter feito o pré-cadastro na unidade."
            marcado={v.dispensaPreCadastro}
            aoMudar={(dispensaPreCadastro) => setV({ ...v, dispensaPreCadastro })}
          />
        ) : null}
        {erros.campos.dispensaPreCadastro ? (
          <p className="text-sm text-destructive">{erros.campos.dispensaPreCadastro}</p>
        ) : null}
      </Secao>
      <Secao titulo="Profissional" descricao="Opcional. Aparece para o paciente junto do horário.">
        <Campo rotulo="Nome do profissional" erro={erros.campos.profissional}>
          <Texto
            placeholder="Ex.: Dra. Ana Souza"
            valor={v.profissional}
            aoMudar={(profissional) => setV({ ...v, profissional })}
          />
        </Campo>
      </Secao>
      <Secao titulo="Estações" descricao="As salas que chamam os pacientes desta sessão.">
        <Marcacoes
          valores={v.estacoes}
          aoMudar={(marcadas) => setV({ ...v, estacoes: marcadas })}
          opcoes={daSessao.map((e) => ({
            valor: e.id,
            rotulo: e.nome,
            descricao: e.etapa === "triagem" ? "Triagem" : "Atendimento",
          }))}
          vazio={
            v.servicoId
              ? "Nenhuma estação atende este serviço. Cadastre uma em Estações."
              : "Escolha o serviço primeiro para ver as estações que o atendem."
          }
        />
        {erros.campos.estacoes ? <p className="text-sm text-destructive">{erros.campos.estacoes}</p> : null}
      </Secao>
      <Aviso texto={erros.geral} />
    </PainelLateral>
  );
}

type ValoresEdicao = {
  semLimite: boolean;
  vagas: string;
  visibilidade: Visibilidade;
  dispensaPreCadastro: boolean;
  profissional: string;
};

function deSessao(s: Sessao): ValoresEdicao {
  return {
    semLimite: s.vagas === null,
    vagas: s.vagas === null ? "" : String(s.vagas),
    visibilidade: s.visibilidade,
    dispensaPreCadastro: s.dispensaPreCadastro,
    profissional: s.profissional ?? "",
  };
}

function PainelEditarSessao({
  sessao,
  aoFechar,
  titulo,
  servicos,
  cancelar,
  aoSalvar,
}: {
  sessao: Sessao | null;
  aoFechar: () => void;
  titulo: string;
  servicos: Servico[];
  cancelar: (s: Sessao) => Promise<boolean>;
  aoSalvar: () => void;
}) {
  const api = useApi();
  const [v, setV] = useState<ValoresEdicao | null>(null);
  const [erros, setErros] = useState(SEM_ERROS);
  const [enviando, setEnviando] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: só ao abrir outra sessão.
  useEffect(() => {
    if (sessao) {
      setV(deSessao(sessao));
      setErros(SEM_ERROS);
    }
  }, [sessao?.id]);

  const permitidas = visibilidadesPermitidas(servicos.find((x) => x.id === sessao?.servicoId)?.modo ?? "livre");
  // A visibilidade só muda enquanto a sessão não terminou (mesma regra de antes).
  const mudaVisibilidade = sessao?.estado === "planejada" || sessao?.estado === "aberta";

  async function aoEnviar() {
    if (!sessao || !v) return;
    const vagas = vagasDoFormulario(v.semLimite, v.vagas);
    if (!vagas.ok) return setErros({ geral: null, campos: { vagas: vagas.erro } });
    const profissional = v.profissional.trim() || null;
    // Só vai o que mudou; `versao` é a trava otimista.
    const edicao: { vagas?: number | null; profissional?: string | null } = {};
    if (vagas.vagas !== sessao.vagas) edicao.vagas = vagas.vagas;
    if (profissional !== sessao.profissional) edicao.profissional = profissional;
    const dispensa = v.visibilidade === "publica" && v.dispensaPreCadastro;
    const mudouVisibilidade =
      mudaVisibilidade && (v.visibilidade !== sessao.visibilidade || dispensa !== sessao.dispensaPreCadastro);

    const temEdicao = Object.keys(edicao).length > 0;
    if (temEdicao) {
      const invalidos = validarNoCliente(sessaoEdicaoSchema, { ...edicao, versao: sessao.versao });
      if (invalidos) return setErros(invalidos);
    }
    if (mudouVisibilidade) {
      const invalidos = validarNoCliente(visibilidadeEntradaSchema, {
        visibilidade: v.visibilidade,
        dispensaPreCadastro: dispensa,
        versao: sessao.versao,
      });
      if (invalidos) return setErros(invalidos);
    }
    if (!temEdicao && !mudouVisibilidade) return aoFechar();

    setEnviando(true);
    try {
      let versao = sessao.versao;
      if (temEdicao) {
        const salva = await api.patch<Sessao>(`/v1/painel/sessoes/${sessao.id}`, { ...edicao, versao });
        versao = salva.versao;
      }
      if (mudouVisibilidade) {
        await api.post(`/v1/painel/sessoes/${sessao.id}/visibilidade`, {
          visibilidade: v.visibilidade,
          dispensaPreCadastro: dispensa,
          versao,
        });
      }
      aoSalvar();
      aoFechar();
    } catch (err) {
      setErros(errosDoEnvio(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <PainelLateral
      aberto={sessao !== null}
      aoFechar={aoFechar}
      titulo="Editar sessão"
      descricao={titulo}
      aoEnviar={aoEnviar}
      acao="Salvar"
      enviando={enviando}
      {...(sessao?.estado === "planejada"
        ? {
            perigo: {
              rotulo: "Cancelar sessão",
              aoClicar: async () => {
                if (await cancelar(sessao)) aoFechar();
              },
            },
          }
        : {})}
    >
      {v ? (
        <>
          <Secao titulo="Vagas">
            <CampoDeVagas
              semLimite={v.semLimite}
              vagas={v.vagas}
              erro={erros.campos.vagas}
              aoMudar={(m) => setV({ ...v, ...m })}
            />
          </Secao>
          {mudaVisibilidade ? (
            <Secao
              titulo="Quem vê esta sessão"
              descricao={permitidas.includes("publica") ? undefined : DICA_DO_REGULADO}
            >
              <Escolha
                valor={v.visibilidade}
                aoMudar={(vis) => setV({ ...v, ...ajustarVisibilidade(v, vis as Visibilidade) })}
                opcoes={opcoesDeVisibilidade(
                  // Já pública num serviço que virou regulado: deixa ficar como está.
                  sessao?.visibilidade === "publica" ? [...permitidas, "publica"] : permitidas,
                )}
              />
              {erros.campos.visibilidade ? (
                <p className="text-sm text-destructive">{erros.campos.visibilidade}</p>
              ) : null}
              {v.visibilidade === "publica" ? (
                <Interruptor
                  rotulo="Dispensar pré-cadastro"
                  descricao="O paciente se inscreve sem ter feito o pré-cadastro na unidade."
                  marcado={v.dispensaPreCadastro}
                  aoMudar={(dispensaPreCadastro) => setV({ ...v, dispensaPreCadastro })}
                />
              ) : null}
              {erros.campos.dispensaPreCadastro ? (
                <p className="text-sm text-destructive">{erros.campos.dispensaPreCadastro}</p>
              ) : null}
            </Secao>
          ) : null}
          <Secao titulo="Profissional" descricao="Opcional. Aparece para o paciente junto do horário.">
            <Campo rotulo="Nome do profissional" erro={erros.campos.profissional}>
              <Texto
                placeholder="Ex.: Dra. Ana Souza"
                valor={v.profissional}
                aoMudar={(profissional) => setV({ ...v, profissional })}
              />
            </Campo>
          </Secao>
          <Aviso texto={erros.geral} />
        </>
      ) : null}
    </PainelLateral>
  );
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

  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<Sessao | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  // Trocou de unidade: fecha os painéis e limpa os avisos da anterior.
  // biome-ignore lint/correctness/useExhaustiveDependencies: só ao trocar de unidade.
  useEffect(() => {
    setCriando(false);
    setEditando(null);
    setAviso(null);
    setOk(null);
  }, [atual]);

  const nome = (id: string, lista: { id: string; nome: string }[]) => lista.find((x) => x.id === id)?.nome ?? "?";
  const horario = (s: Sessao) => `${horarioParaTela(s.inicio, fuso).hora}–${horarioParaTela(s.fim, fuso).hora}`;

  async function cancelar(s: Sessao): Promise<boolean> {
    const sim = await confirmar({
      titulo: "Cancelar esta sessão?",
      descricao: `${nome(s.servicoId, servicos)}, ${horario(s)}.`,
      acao: "Cancelar sessão",
      perigo: true,
    });
    if (!sim) return false;
    try {
      await api.post(`/v1/painel/sessoes/${s.id}/cancelar`, {});
      setAviso(null);
      setOk(`Sessão das ${horario(s)} cancelada.`);
      sessoes.recarregar();
      return true;
    } catch (err) {
      setAviso(mensagemDoErro(err));
      return false;
    }
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <CabecalhoDaPagina
        titulo="Sessões"
        descricao="Os horários de atendimento de cada dia, com vagas e se aparecem na agenda do app."
        acoes={
          atual ? (
            <Button onClick={() => setCriando(true)}>
              <PlusIcon data-icon="inline-start" strokeWidth={2.75} />
              Adicionar sessão
            </Button>
          ) : null
        }
      />
      <div className="flex flex-wrap items-end gap-4">
        <SeletorDeUnidade unidades={unidades} atual={atual} escolher={escolher} erro={erroDasUnidades} />
        <Campo rotulo="Dia" className="w-full sm:w-52">
          <Texto type="date" valor={dia} aoMudar={(novo) => diaValido(novo) && setDia(novo)} />
        </Campo>
      </div>
      <Aviso texto={sessoes.erro ?? aviso} />
      <Aviso texto={ok} tipo="ok" />
      {atual ? (
        <Tabela cabecalho={["Horário", "Serviço", "Vagas", "Visibilidade", "Profissional", "Estado", ""]}>
          {sessoes.itens.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="font-semibold text-slate-900">{horario(s)}</TableCell>
              <TableCell>{nome(s.servicoId, servicos)}</TableCell>
              <TableCell>{s.vagas === null ? `${s.ocupadas} / sem limite` : `${s.ocupadas} / ${s.vagas}`}</TableCell>
              <TableCell>
                {VISIBILIDADES[s.visibilidade].rotulo}
                {s.dispensaPreCadastro ? " · sem pré-cadastro" : ""}
              </TableCell>
              <TableCell>{s.profissional ?? "—"}</TableCell>
              <TableCell>
                <EstadoDaSessao estado={s.estado} />
              </TableCell>
              <TableCell>
                <AcoesDaLinha
                  {...(s.estado === "planejada"
                    ? { excluir: { rotulo: "Cancelar sessão", aoClicar: () => void cancelar(s) } }
                    : {})}
                  {...(s.estado === "planejada" || s.estado === "aberta"
                    ? { editar: { rotulo: "Editar sessão", aoClicar: () => setEditando(s) } }
                    : {})}
                />
              </TableCell>
            </TableRow>
          ))}
          {sessoes.itens.length === 0 && !sessoes.erro ? (
            <TableRow>
              <TableCell colSpan={7} className="py-8 text-center text-slate-500">
                Nenhuma sessão neste dia. Use "Adicionar sessão".
              </TableCell>
            </TableRow>
          ) : null}
        </Tabela>
      ) : null}
      <PainelNovaSessao
        aberto={criando}
        aoFechar={() => setCriando(false)}
        dia={dia}
        fuso={fuso}
        servicos={servicos}
        estacoes={estacoes}
        enviar={async (corpo) => {
          await api.post(`/v1/painel/unidades/${atual}/sessoes`, corpo);
          setAviso(null);
          setOk("Sessão criada.");
          sessoes.recarregar();
        }}
      />
      <PainelEditarSessao
        sessao={editando}
        aoFechar={() => setEditando(null)}
        titulo={editando ? `${nome(editando.servicoId, servicos)}, ${horario(editando)}.` : ""}
        servicos={servicos}
        cancelar={cancelar}
        aoSalvar={() => {
          setAviso(null);
          setOk("Sessão salva.");
          sessoes.recarregar();
        }}
      />
    </div>
  );
}
