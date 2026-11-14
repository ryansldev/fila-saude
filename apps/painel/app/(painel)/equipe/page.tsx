"use client";

import { atribuicoesSchema, usuarioPainelEntradaSchema } from "@fila-saude/schemas/usuario";
import { PlusIcon, XIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useConfirmar } from "@/components/dialogos";
import { Aviso, Campo, PainelLateral, Secao, Selecao, Tabela, Texto } from "@/components/formulario";
import { AcoesDaLinha, CabecalhoDaPagina } from "@/components/pagina";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { useApi } from "@/lib/api-context";
import { type ErrosDoEnvio, errosDoEnvio, mensagemDoErro, validarNoCliente } from "@/lib/formularios/erros";
import {
  type Atribuicoes,
  FUNCOES,
  type Funcao,
  funcoesQuePodeConceder,
  OCUPACOES,
  type Ocupacao,
  problemasDoCadastro,
  resumoDasAtribuicoes,
  TODAS_AS_OCUPACOES,
  unidadesQuePodeAtribuir,
} from "@/lib/formularios/usuario";
import { useEu } from "@/lib/sessao";
import { useLista } from "@/lib/use-lista";

type Usuario = Atribuicoes & { id: string; login: string; nome: string };
type Unidade = { id: string; nome: string };

const SEM_ERROS: ErrosDoEnvio = { geral: null, campos: {} };
const VAZIO: Atribuicoes = { vinculos: [], funcoes: [] };
const OPCOES_OCUPACAO = TODAS_AS_OCUPACOES.map((o) => ({ valor: o, rotulo: OCUPACOES[o].rotulo }));
// Só o que o login aceita (sem acento, espaço ou hífen): a pessoa vê na hora.
const mascaraDoLogin = (t: string) => t.toLowerCase().replace(/[^a-z0-9_.]/g, "");

/** Botão neutro de tirar uma linha da lista (só o ícone; o nome vai no aria-label). */
function BotaoRemover({ rotulo, aoClicar }: { rotulo: string; aoClicar: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="mb-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-900"
      aria-label={rotulo}
      title={rotulo}
      onClick={aoClicar}
    >
      <XIcon />
    </Button>
  );
}

/** Subtítulo de um grupo dentro da seção, com a linha de explicação. */
function Grupo({ titulo, descricao, children }: { titulo: string; descricao: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-sm font-semibold text-slate-900">{titulo}</h3>
        <p className="text-sm text-slate-500">{descricao}</p>
      </div>
      {children}
    </div>
  );
}

/** Ocupações por unidade e funções, com só o que o ator pode conceder. */
function EditorDeAtribuicoes({
  valor,
  mudar,
  ator,
  unidades,
  erros,
}: {
  valor: Atribuicoes;
  mudar: (a: Atribuicoes) => void;
  ator: Atribuicoes;
  unidades: Unidade[];
  erros: Record<string, string>;
}) {
  const permitidas = unidadesQuePodeAtribuir(ator, unidades);
  const funcoes = funcoesQuePodeConceder(ator);
  const primeira = permitidas.length === 1 ? (permitidas[0]?.id ?? "") : "";
  const opcoesDeUnidade = permitidas.map((u) => ({ valor: u.id, rotulo: u.nome }));
  const opcoesDeFuncao = funcoes.map((fn) => ({ valor: fn, rotulo: FUNCOES[fn].rotulo }));
  const linha = "grid items-end gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_1fr_auto]";

  const seletorDeUnidade = (atual: string | null, aoMudar: (id: string) => void, erro?: string) => (
    <Campo rotulo="Unidade" erro={erro}>
      <Selecao valor={atual ?? ""} opcoes={opcoesDeUnidade} placeholder="Escolha a unidade" aoMudar={aoMudar} />
    </Campo>
  );

  return (
    <div className="flex flex-col gap-6">
      <Grupo titulo="Ocupação na unidade" descricao="O que a pessoa é na unidade (o mesmo do vínculo no CNES).">
        {valor.vinculos.map((v, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: linhas editáveis sem id próprio
          <div key={i} className={linha}>
            {seletorDeUnidade(
              v.unidadeId,
              (id) =>
                mudar({ ...valor, vinculos: valor.vinculos.map((x, j) => (j === i ? { ...x, unidadeId: id } : x)) }),
              erros[`vinculos.${i}.unidadeId`],
            )}
            <Campo rotulo="Ocupação">
              <Selecao
                valor={v.ocupacao}
                opcoes={OPCOES_OCUPACAO}
                aoMudar={(ocupacao) =>
                  mudar({
                    ...valor,
                    vinculos: valor.vinculos.map((x, j) => (j === i ? { ...x, ocupacao: ocupacao as Ocupacao } : x)),
                  })
                }
              />
            </Campo>
            <BotaoRemover
              rotulo={`Remover ocupação ${i + 1}`}
              aoClicar={() => mudar({ ...valor, vinculos: valor.vinculos.filter((_, j) => j !== i) })}
            />
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="self-start"
          disabled={permitidas.length === 0}
          onClick={() =>
            mudar({ ...valor, vinculos: [...valor.vinculos, { unidadeId: primeira, ocupacao: "recepcao" }] })
          }
        >
          <PlusIcon data-icon="inline-start" />
          Adicionar ocupação
        </Button>
      </Grupo>

      {funcoes.length > 0 ? (
        <Grupo
          titulo="Funções e permissões"
          descricao="Gestão e permissões extras. Só aparece o que você pode conceder."
        >
          {valor.funcoes.map((f, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: linhas editáveis sem id próprio
            <div key={i} className={linha}>
              <Campo rotulo="Função">
                <Selecao
                  valor={f.funcao}
                  opcoes={opcoesDeFuncao}
                  aoMudar={(escolhida) => {
                    if (!escolhida) return;
                    const funcao = escolhida as Funcao;
                    const doMunicipio = FUNCOES[funcao].escopo === "municipio";
                    mudar({
                      ...valor,
                      funcoes: valor.funcoes.map((x, j) =>
                        j === i ? { funcao, unidadeId: doMunicipio ? null : (x.unidadeId ?? (primeira || null)) } : x,
                      ),
                    });
                  }}
                />
              </Campo>
              {FUNCOES[f.funcao].escopo === "unidade" ? (
                seletorDeUnidade(
                  f.unidadeId,
                  (id) =>
                    mudar({
                      ...valor,
                      funcoes: valor.funcoes.map((x, j) => (j === i ? { ...x, unidadeId: id || null } : x)),
                    }),
                  erros[`funcoes.${i}.unidadeId`],
                )
              ) : (
                <span className="pb-2 text-sm text-slate-500">Vale para todo o município</span>
              )}
              <BotaoRemover
                rotulo={`Remover função ${i + 1}`}
                aoClicar={() => mudar({ ...valor, funcoes: valor.funcoes.filter((_, j) => j !== i) })}
              />
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="self-start"
            onClick={() => {
              const funcao = funcoes.includes("agendar") ? "agendar" : (funcoes[0] as Funcao);
              const unidadeId = FUNCOES[funcao].escopo === "municipio" ? null : primeira || null;
              mudar({ ...valor, funcoes: [...valor.funcoes, { funcao, unidadeId }] });
            }}
          >
            <PlusIcon data-icon="inline-start" />
            Adicionar função
          </Button>
        </Grupo>
      ) : null}
      {erros._ ? <span className="text-sm text-destructive">{erros._}</span> : null}
    </div>
  );
}

const limpar = (a: Atribuicoes): Atribuicoes => ({
  vinculos: a.vinculos.map((v) => ({ ...v, unidadeId: v.unidadeId })),
  funcoes: a.funcoes.map((f) => ({ ...f, unidadeId: f.unidadeId || null })),
});

export default function Equipe() {
  const api = useApi();
  const eu = useEu();
  const usuarios = useLista<Usuario>("/v1/painel/usuarios");
  const { itens: unidades } = useLista<Unidade>("/v1/painel/unidades");
  const [v, setV] = useState({ login: "", nome: "", senha: "" });
  const [atribuicoes, setAtribuicoes] = useState<Atribuicoes>(VAZIO);
  const [erros, setErros] = useState(SEM_ERROS);
  const [ok, setOk] = useState<string | null>(null);
  const [editando, setEditando] = useState<{ id: string; valor: Atribuicoes; erros: ErrosDoEnvio } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const confirmar = useConfirmar();

  if (eu.estado !== "autenticado") return null;
  const ator: Atribuicoes = { vinculos: eu.eu.vinculos, funcoes: eu.eu.funcoes };
  const nomeDaUnidade = (id: string | null) => (id ? (unidades.find((u) => u.id === id)?.nome ?? "?") : "");

  async function criar() {
    setOk(null);
    const alvo = limpar(atribuicoes);
    const problemas = problemasDoCadastro(ator, alvo);
    if (Object.keys(problemas).length > 0) return setErros({ geral: null, campos: problemas });
    const corpo = { ...v, ...alvo };
    const invalidos = validarNoCliente(usuarioPainelEntradaSchema, corpo);
    if (invalidos) return setErros(invalidos);
    setEnviando(true);
    try {
      await api.post("/v1/painel/usuarios", corpo);
      setErros(SEM_ERROS);
      setCriando(false);
      setOk(`${v.nome} cadastrado(a). Passe o login e a senha para a pessoa.`);
      setV({ login: "", nome: "", senha: "" });
      setAtribuicoes(VAZIO);
      usuarios.recarregar();
    } catch (err) {
      setErros(errosDoEnvio(err));
    } finally {
      setEnviando(false);
    }
  }

  async function remover(u: Usuario) {
    const ok = await confirmar({
      titulo: `Excluir ${u.nome} da equipe?`,
      descricao: "A pessoa não consegue mais entrar no painel.",
      acao: "Excluir",
      perigo: true,
    });
    if (!ok) return;
    try {
      await api.del(`/v1/painel/usuarios/${u.id}`);
      setAviso(null);
      if (editando?.id === u.id) setEditando(null);
      usuarios.recarregar();
    } catch (err) {
      setAviso(mensagemDoErro(err));
    }
  }

  async function salvar() {
    if (!editando) return;
    const alvo = limpar(editando.valor);
    const problemas = problemasDoCadastro(ator, alvo);
    if (Object.keys(problemas).length > 0)
      return setEditando({ ...editando, erros: { geral: null, campos: problemas } });
    const invalidos = validarNoCliente(atribuicoesSchema, alvo);
    if (invalidos) return setEditando({ ...editando, erros: invalidos });
    setEnviando(true);
    try {
      await api.put(`/v1/painel/usuarios/${editando.id}/atribuicoes`, alvo);
      setOk(`${nomeDe(editando.id)}: ocupações e funções salvas.`);
      setEditando(null);
      usuarios.recarregar();
    } catch (err) {
      const e = errosDoEnvio(err);
      setEditando({ ...editando, erros: e.geral ? e : { geral: mensagemDoErro(err), campos: e.campos } });
    } finally {
      setEnviando(false);
    }
  }

  const nomeDe = (id: string) => usuarios.itens.find((u) => u.id === id)?.nome ?? "";

  return (
    <div className="flex w-full flex-col gap-6">
      <CabecalhoDaPagina
        titulo="Equipe"
        descricao="Quem entra no painel e o que cada pessoa faz em cada unidade."
        acoes={
          <Button
            onClick={() => {
              setErros(SEM_ERROS);
              setCriando(true);
            }}
          >
            <PlusIcon data-icon="inline-start" strokeWidth={2.75} />
            Adicionar usuário
          </Button>
        }
      />
      <Aviso texto={usuarios.erro ?? aviso} />
      <Aviso texto={ok} tipo="ok" />
      <Tabela cabecalho={["Nome", "Login", "Ocupações e funções", ""]}>
        {usuarios.itens.map((u) => (
          <TableRow key={u.id}>
            <TableCell className="font-semibold text-slate-900">{u.nome}</TableCell>
            <TableCell>{u.login}</TableCell>
            <TableCell className="whitespace-normal">{resumoDasAtribuicoes(u, nomeDaUnidade)}</TableCell>
            <TableCell>
              <AcoesDaLinha
                {...(u.id !== eu.eu.id ? { excluir: { rotulo: `Excluir ${u.nome}`, aoClicar: () => remover(u) } } : {})}
                editar={{
                  rotulo: `Editar ${u.nome}`,
                  aoClicar: () =>
                    setEditando({ id: u.id, valor: { vinculos: u.vinculos, funcoes: u.funcoes }, erros: SEM_ERROS }),
                }}
              />
            </TableCell>
          </TableRow>
        ))}
        {usuarios.itens.length === 0 && !usuarios.erro ? (
          <TableRow>
            <TableCell colSpan={4} className="py-8 text-center text-slate-500">
              Ninguém na equipe ainda. Use "Adicionar usuário".
            </TableCell>
          </TableRow>
        ) : null}
      </Tabela>

      <PainelLateral
        aberto={editando !== null}
        aoFechar={() => setEditando(null)}
        titulo={`Editar ${editando ? nomeDe(editando.id) : "usuário"}`}
        descricao="Ocupações e funções desta pessoa em cada unidade."
        aoEnviar={salvar}
        acao="Salvar"
        enviando={enviando}
      >
        {editando ? (
          <>
            <Secao titulo="O que a pessoa faz" descricao="Define as telas e as ações que ela vê no painel.">
              <EditorDeAtribuicoes
                valor={editando.valor}
                mudar={(valor) => setEditando({ ...editando, valor })}
                ator={ator}
                unidades={unidades}
                erros={editando.erros.campos}
              />
            </Secao>
            <Aviso texto={editando.erros.geral} />
          </>
        ) : null}
      </PainelLateral>

      <PainelLateral
        aberto={criando}
        aoFechar={() => setCriando(false)}
        titulo="Adicionar usuário"
        descricao="Login e senha inicial para o painel, e o que a pessoa faz em cada unidade."
        aoEnviar={criar}
        acao="Cadastrar"
        enviando={enviando}
      >
        <Secao titulo="Acesso ao painel" descricao="Passe o login e a senha para a pessoa; ela entra com eles.">
          <Campo rotulo="Nome" erro={erros.campos.nome}>
            <Texto required valor={v.nome} aoMudar={(nome) => setV({ ...v, nome })} />
          </Campo>
          <div className="grid gap-x-5 gap-y-5 sm:grid-cols-2">
            <Campo rotulo="Login" erro={erros.campos.login} dica="Letras, números, ponto ou _.">
              <Texto
                required
                autoCapitalize="none"
                maxLength={30}
                valor={v.login}
                mascara={mascaraDoLogin}
                aoMudar={(login) => setV({ ...v, login })}
              />
            </Campo>
            <Campo rotulo="Senha inicial" erro={erros.campos.senha} dica="Mínimo de 8 caracteres.">
              <Texto
                required
                type="password"
                autoComplete="new-password"
                valor={v.senha}
                aoMudar={(senha) => setV({ ...v, senha })}
              />
            </Campo>
          </div>
        </Secao>
        <Secao titulo="O que a pessoa faz" descricao="Define as telas e as ações que ela vê no painel.">
          <EditorDeAtribuicoes
            valor={atribuicoes}
            mudar={setAtribuicoes}
            ator={ator}
            unidades={unidades}
            erros={erros.campos}
          />
        </Secao>
        <Aviso texto={erros.geral} />
      </PainelLateral>
    </div>
  );
}
