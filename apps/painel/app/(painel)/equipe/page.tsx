"use client";

import { atribuicoesSchema, usuarioPainelEntradaSchema } from "@fila-saude/schemas/usuario";
import { PlusIcon, SettingsIcon, Trash2Icon } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useConfirmar } from "@/components/dialogos";
import { Aviso, Campo, Cartao, LARGURA_DO_PAINEL_LATERAL, Selecao, Tabela, Texto } from "@/components/formulario";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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

  const seletorDeUnidade = (atual: string | null, aoMudar: (id: string) => void, erro?: string) => (
    <Campo rotulo="Unidade" erro={erro}>
      <Selecao valor={atual ?? ""} opcoes={opcoesDeUnidade} placeholder="Escolha a unidade" aoMudar={aoMudar} />
    </Campo>
  );

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold text-gray-800">Ocupação na unidade</legend>
        <p className="text-xs text-gray-500">O que a pessoa é na unidade (o mesmo do vínculo no CNES).</p>
        {valor.vinculos.map((v, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: linhas editáveis sem id próprio
          <div key={i} className="flex flex-wrap items-end gap-2">
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
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => mudar({ ...valor, vinculos: valor.vinculos.filter((_, j) => j !== i) })}
            >
              Remover
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          disabled={permitidas.length === 0}
          onClick={() =>
            mudar({ ...valor, vinculos: [...valor.vinculos, { unidadeId: primeira, ocupacao: "recepcao" }] })
          }
        >
          Adicionar ocupação
        </Button>
      </fieldset>

      {funcoes.length > 0 ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-semibold text-gray-800">Funções e permissões</legend>
          <p className="text-xs text-gray-500">Gestão e permissões extras. Só aparece o que você pode conceder.</p>
          {valor.funcoes.map((f, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: linhas editáveis sem id próprio
            <div key={i} className="flex flex-wrap items-end gap-2">
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
                <span className="pb-2 text-sm text-gray-500">todo o município</span>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => mudar({ ...valor, funcoes: valor.funcoes.filter((_, j) => j !== i) })}
              >
                Remover
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => {
              const funcao = funcoes.includes("agendar") ? "agendar" : (funcoes[0] as Funcao);
              const unidadeId = FUNCOES[funcao].escopo === "municipio" ? null : primeira || null;
              mudar({ ...valor, funcoes: [...valor.funcoes, { funcao, unidadeId }] });
            }}
          >
            Adicionar função
          </Button>
        </fieldset>
      ) : null}
      {erros._ ? <span className="text-sm text-red-700">{erros._}</span> : null}
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
  const confirmar = useConfirmar();

  if (eu.estado !== "autenticado") return null;
  const ator: Atribuicoes = { vinculos: eu.eu.vinculos, funcoes: eu.eu.funcoes };
  const nomeDaUnidade = (id: string | null) => (id ? (unidades.find((u) => u.id === id)?.nome ?? "?") : "");

  async function criar(e: FormEvent) {
    e.preventDefault();
    setOk(null);
    const alvo = limpar(atribuicoes);
    const problemas = problemasDoCadastro(ator, alvo);
    if (Object.keys(problemas).length > 0) return setErros({ geral: null, campos: problemas });
    const corpo = { ...v, ...alvo };
    const invalidos = validarNoCliente(usuarioPainelEntradaSchema, corpo);
    if (invalidos) return setErros(invalidos);
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
    try {
      await api.put(`/v1/painel/usuarios/${editando.id}/atribuicoes`, alvo);
      setOk(`${nomeDe(editando.id)}: ocupações e funções salvas.`);
      setEditando(null);
      usuarios.recarregar();
    } catch (err) {
      const e = errosDoEnvio(err);
      setEditando({ ...editando, erros: e.geral ? e : { geral: mensagemDoErro(err), campos: e.campos } });
    }
  }

  const nomeDe = (id: string) => usuarios.itens.find((u) => u.id === id)?.nome ?? "";

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Equipe</h1>
        <Button
          onClick={() => {
            setErros(SEM_ERROS);
            setCriando(true);
          }}
        >
          <PlusIcon data-icon="inline-start" strokeWidth={2.75} />
          Adicionar usuário
        </Button>
      </div>
      <Aviso texto={usuarios.erro ?? aviso} />
      <Aviso texto={ok} tipo="ok" />
      <Tabela cabecalho={["Nome", "Login", "Ocupações e funções", ""]}>
        {usuarios.itens.map((u) => (
          <TableRow key={u.id}>
            <TableCell className="font-medium">{u.nome}</TableCell>
            <TableCell>{u.login}</TableCell>
            <TableCell className="whitespace-normal">{resumoDasAtribuicoes(u, nomeDaUnidade)}</TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-1">
                {u.id !== eu.eu.id ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-gray-500 hover:text-gray-900"
                    aria-label={`Excluir ${u.nome}`}
                    title="Excluir"
                    onClick={() => remover(u)}
                  >
                    <Trash2Icon />
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-gray-500 hover:text-gray-900"
                  aria-label={`Editar ${u.nome}`}
                  title="Editar"
                  onClick={() =>
                    setEditando({ id: u.id, valor: { vinculos: u.vinculos, funcoes: u.funcoes }, erros: SEM_ERROS })
                  }
                >
                  <SettingsIcon />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
        {usuarios.itens.length === 0 && !usuarios.erro ? (
          <TableRow>
            <TableCell colSpan={4} className="py-8 text-center text-gray-500">
              Ninguém na equipe ainda. Use "Adicionar usuário".
            </TableCell>
          </TableRow>
        ) : null}
      </Tabela>

      {/* Alterar: ocupações e funções ao lado, sem perder a lista de vista. */}
      <Sheet open={editando !== null} onOpenChange={(abrir) => !abrir && setEditando(null)}>
        <SheetContent side="right" className={LARGURA_DO_PAINEL_LATERAL}>
          {editando ? (
            <>
              <SheetHeader className="border-b">
                <SheetTitle>Editar · {nomeDe(editando.id)}</SheetTitle>
                <SheetDescription>Ocupações e funções desta pessoa em cada unidade.</SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-4 overflow-y-auto p-4">
                <EditorDeAtribuicoes
                  valor={editando.valor}
                  mudar={(valor) => setEditando({ ...editando, valor })}
                  ator={ator}
                  unidades={unidades}
                  erros={editando.erros.campos}
                />
                <Aviso texto={editando.erros.geral} />
              </div>
              <SheetFooter className="border-t sm:flex-row sm:justify-end">
                <Button variant="ghost" onClick={() => setEditando(null)}>
                  Cancelar
                </Button>
                <Button onClick={salvar}>Salvar</Button>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* Cadastro de pessoa num painel lateral, aberto pelo botão "Adicionar usuário". */}
      <Sheet open={criando} onOpenChange={setCriando}>
        <SheetContent side="right" className={LARGURA_DO_PAINEL_LATERAL}>
          <SheetHeader className="border-b">
            <SheetTitle>Adicionar usuário</SheetTitle>
            <SheetDescription>
              Login e senha inicial para o painel, e o que a pessoa faz em cada unidade.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={criar} className="flex min-h-0 flex-1 flex-col">
            <div className="flex flex-col gap-4 overflow-y-auto p-4">
              <Campo rotulo="Nome" erro={erros.campos.nome}>
                <Texto required valor={v.nome} aoMudar={(nome) => setV({ ...v, nome })} />
              </Campo>
              <Campo rotulo="Login" erro={erros.campos.login} dica="letras, números, ponto ou _">
                <Texto
                  required
                  autoCapitalize="none"
                  maxLength={30}
                  valor={v.login}
                  mascara={mascaraDoLogin}
                  aoMudar={(login) => setV({ ...v, login })}
                />
              </Campo>
              <Campo rotulo="Senha inicial" erro={erros.campos.senha} dica="mínimo 8 caracteres">
                <Texto
                  required
                  type="password"
                  autoComplete="new-password"
                  valor={v.senha}
                  aoMudar={(senha) => setV({ ...v, senha })}
                />
              </Campo>
              <EditorDeAtribuicoes
                valor={atribuicoes}
                mudar={setAtribuicoes}
                ator={ator}
                unidades={unidades}
                erros={erros.campos}
              />
              <Aviso texto={erros.geral} />
            </div>
            <SheetFooter className="border-t sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" onClick={() => setCriando(false)}>
                Cancelar
              </Button>
              <Button type="submit">Cadastrar</Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
