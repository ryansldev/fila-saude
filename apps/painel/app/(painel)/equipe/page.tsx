"use client";

import { type FormEvent, useState } from "react";
import { Aviso, Campo, Cartao, classeDoCampo, Tabela } from "@/components/formulario";
import { Button } from "@/components/ui/button";
import { useApi } from "@/lib/api-context";
import { type ErrosDoEnvio, errosDoEnvio, mensagemDoErro } from "@/lib/formularios/erros";
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

  const seletorDeUnidade = (atual: string | null, aoMudar: (id: string) => void, erro?: string) => (
    <Campo rotulo="Unidade" erro={erro}>
      <select className={classeDoCampo} value={atual ?? ""} onChange={(e) => aoMudar(e.target.value)}>
        <option value="">Escolha a unidade</option>
        {permitidas.map((u) => (
          <option key={u.id} value={u.id}>
            {u.nome}
          </option>
        ))}
      </select>
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
              <select
                className={classeDoCampo}
                value={v.ocupacao}
                onChange={(e) =>
                  mudar({
                    ...valor,
                    vinculos: valor.vinculos.map((x, j) =>
                      j === i ? { ...x, ocupacao: e.target.value as Ocupacao } : x,
                    ),
                  })
                }
              >
                {TODAS_AS_OCUPACOES.map((o) => (
                  <option key={o} value={o}>
                    {OCUPACOES[o].rotulo}
                  </option>
                ))}
              </select>
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
                <select
                  className={classeDoCampo}
                  value={f.funcao}
                  onChange={(e) => {
                    const funcao = e.target.value as Funcao;
                    const doMunicipio = FUNCOES[funcao].escopo === "municipio";
                    mudar({
                      ...valor,
                      funcoes: valor.funcoes.map((x, j) =>
                        j === i ? { funcao, unidadeId: doMunicipio ? null : (x.unidadeId ?? (primeira || null)) } : x,
                      ),
                    });
                  }}
                >
                  {funcoes.map((fn) => (
                    <option key={fn} value={fn}>
                      {FUNCOES[fn].rotulo}
                    </option>
                  ))}
                </select>
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

  if (eu.estado !== "autenticado") return null;
  const ator: Atribuicoes = { vinculos: eu.eu.vinculos, funcoes: eu.eu.funcoes };
  const nomeDaUnidade = (id: string | null) => (id ? (unidades.find((u) => u.id === id)?.nome ?? "?") : "");

  async function criar(e: FormEvent) {
    e.preventDefault();
    setOk(null);
    const alvo = limpar(atribuicoes);
    const problemas = problemasDoCadastro(ator, alvo);
    if (Object.keys(problemas).length > 0) return setErros({ geral: null, campos: problemas });
    try {
      await api.post("/v1/painel/usuarios", { ...v, ...alvo });
      setErros(SEM_ERROS);
      setOk(`${v.nome} cadastrado(a). Passe o login e a senha para a pessoa.`);
      setV({ login: "", nome: "", senha: "" });
      setAtribuicoes(VAZIO);
      usuarios.recarregar();
    } catch (err) {
      setErros(errosDoEnvio(err));
    }
  }

  async function remover(u: Usuario) {
    if (!window.confirm(`Remover ${u.nome} da equipe? A pessoa não consegue mais entrar no painel.`)) return;
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
    try {
      await api.put(`/v1/painel/usuarios/${editando.id}/atribuicoes`, alvo);
      setEditando(null);
      usuarios.recarregar();
    } catch (err) {
      const e = errosDoEnvio(err);
      setEditando({ ...editando, erros: e.geral ? e : { geral: mensagemDoErro(err), campos: e.campos } });
    }
  }

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <h1 className="text-2xl font-bold text-gray-900">Equipe</h1>
      <Aviso texto={usuarios.erro ?? aviso} />
      <Tabela cabecalho={["Nome", "Login", "Ocupações e funções", ""]}>
        {usuarios.itens.map((u) => (
          <tr key={u.id}>
            <td className="py-2 pr-4 font-medium">{u.nome}</td>
            <td className="py-2 pr-4">{u.login}</td>
            <td className="py-2 pr-4">{resumoDasAtribuicoes(u, nomeDaUnidade)}</td>
            <td className="py-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setEditando({ id: u.id, valor: { vinculos: u.vinculos, funcoes: u.funcoes }, erros: SEM_ERROS })
                }
              >
                Alterar
              </Button>
              {u.id !== eu.eu.id ? (
                <Button variant="ghost" size="sm" onClick={() => remover(u)}>
                  Remover
                </Button>
              ) : null}
            </td>
          </tr>
        ))}
      </Tabela>
      {editando ? (
        <Cartao titulo={`Ocupações e funções de ${usuarios.itens.find((u) => u.id === editando.id)?.nome ?? ""}`}>
          <EditorDeAtribuicoes
            valor={editando.valor}
            mudar={(valor) => setEditando({ ...editando, valor })}
            ator={ator}
            unidades={unidades}
            erros={editando.erros.campos}
          />
          <Aviso texto={editando.erros.geral} />
          <div className="flex gap-2">
            <Button onClick={salvar}>Salvar</Button>
            <Button variant="ghost" onClick={() => setEditando(null)}>
              Cancelar
            </Button>
          </div>
        </Cartao>
      ) : null}
      <Cartao titulo="Cadastrar pessoa">
        <form onSubmit={criar} className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Campo rotulo="Nome" erro={erros.campos.nome}>
              <input
                className={classeDoCampo}
                required
                value={v.nome}
                onChange={(e) => setV({ ...v, nome: e.target.value })}
              />
            </Campo>
            <Campo rotulo="Login" erro={erros.campos.login} dica="letras, números, ponto ou _">
              <input
                className={classeDoCampo}
                required
                autoCapitalize="none"
                value={v.login}
                maxLength={30}
                // Só o que o login aceita (sem acento, espaço ou hífen): a pessoa vê na hora.
                onChange={(e) => setV({ ...v, login: e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, "") })}
              />
            </Campo>
            <Campo rotulo="Senha inicial" erro={erros.campos.senha} dica="mínimo 8 caracteres">
              <input
                className={classeDoCampo}
                required
                type="password"
                autoComplete="new-password"
                value={v.senha}
                onChange={(e) => setV({ ...v, senha: e.target.value })}
              />
            </Campo>
          </div>
          <EditorDeAtribuicoes
            valor={atribuicoes}
            mudar={setAtribuicoes}
            ator={ator}
            unidades={unidades}
            erros={erros.campos}
          />
          <Aviso texto={erros.geral} />
          <Aviso texto={ok} tipo="ok" />
          <Button type="submit" className="self-start">
            Cadastrar
          </Button>
        </form>
      </Cartao>
    </div>
  );
}
