"use client";

import { type FormEvent, useState } from "react";
import { Aviso, Campo, Cartao, classeDoCampo, Tabela } from "@/components/formulario";
import { Button } from "@/components/ui/button";
import { useApi } from "@/lib/api-context";
import { type ErrosDoEnvio, errosDoEnvio, mensagemDoErro } from "@/lib/formularios/erros";
import { type PerfilEscolhido, type PerfilPainel, problemasDosPerfis, ROTULOS_PERFIL } from "@/lib/formularios/usuario";
import { useLista } from "@/lib/use-lista";

type Usuario = { id: string; login: string; nome: string; perfis: PerfilEscolhido[] };
type Unidade = { id: string; nome: string };

const SEM_ERROS: ErrosDoEnvio = { geral: null, campos: {} };
const PERFIS = Object.keys(ROTULOS_PERFIL) as PerfilPainel[];

function EditorDePerfis({
  perfis,
  unidades,
  mudar,
  erros,
}: {
  perfis: PerfilEscolhido[];
  unidades: Unidade[];
  mudar: (p: PerfilEscolhido[]) => void;
  erros: Record<string, string>;
}) {
  return (
    <div className="flex flex-col gap-2">
      {perfis.map((p, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: linhas editáveis sem id próprio
        <div key={i} className="flex flex-wrap items-end gap-2">
          <Campo rotulo="Perfil">
            <select
              className={classeDoCampo}
              value={p.perfil}
              onChange={(e) => {
                const perfil = e.target.value as PerfilPainel;
                mudar(
                  perfis.map((x, j) => (j === i ? { perfil, unidadeId: perfil === "gestor" ? null : x.unidadeId } : x)),
                );
              }}
            >
              {PERFIS.map((pp) => (
                <option key={pp} value={pp}>
                  {ROTULOS_PERFIL[pp]}
                </option>
              ))}
            </select>
          </Campo>
          {p.perfil !== "gestor" ? (
            <Campo rotulo="Unidade" erro={erros[`perfis.${i}.unidadeId`]}>
              <select
                className={classeDoCampo}
                value={p.unidadeId ?? ""}
                onChange={(e) =>
                  mudar(perfis.map((x, j) => (j === i ? { ...x, unidadeId: e.target.value || null } : x)))
                }
              >
                <option value="">Escolha a unidade</option>
                {unidades.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome}
                  </option>
                ))}
              </select>
            </Campo>
          ) : (
            <span className="pb-2 text-sm text-gray-500">todo o município</span>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={() => mudar(perfis.filter((_, j) => j !== i))}>
            Remover
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() =>
          mudar([
            ...perfis,
            { perfil: "recepcao", unidadeId: unidades.length === 1 ? (unidades[0]?.id ?? null) : null },
          ])
        }
      >
        Adicionar perfil
      </Button>
      {erros.perfis ? <span className="text-xs text-red-700">{erros.perfis}</span> : null}
    </div>
  );
}

export default function Usuarios() {
  const api = useApi();
  const usuarios = useLista<Usuario>("/v1/painel/usuarios");
  const { itens: unidades } = useLista<Unidade>("/v1/painel/unidades");
  const [v, setV] = useState({ login: "", nome: "", senha: "" });
  const [perfis, setPerfis] = useState<PerfilEscolhido[]>([]);
  const [erros, setErros] = useState(SEM_ERROS);
  const [ok, setOk] = useState<string | null>(null);
  const [editando, setEditando] = useState<{ id: string; perfis: PerfilEscolhido[]; erro: string | null } | null>(null);

  const nomeDaUnidade = (id: string | null) => (id ? (unidades.find((u) => u.id === id)?.nome ?? "?") : "município");

  async function criar(e: FormEvent) {
    e.preventDefault();
    setOk(null);
    const problemas = problemasDosPerfis(perfis);
    if (Object.keys(problemas).length > 0) return setErros({ geral: null, campos: problemas });
    try {
      await api.post("/v1/painel/usuarios", { ...v, perfis });
      setErros(SEM_ERROS);
      setOk(`Usuário ${v.login} criado. Passe o login e a senha para a pessoa.`);
      setV({ login: "", nome: "", senha: "" });
      setPerfis([]);
      usuarios.recarregar();
    } catch (err) {
      setErros(errosDoEnvio(err));
    }
  }

  async function salvarPerfis() {
    if (!editando) return;
    const problemas = problemasDosPerfis(editando.perfis);
    if (Object.keys(problemas).length > 0)
      return setEditando({ ...editando, erro: Object.values(problemas)[0] ?? null });
    try {
      await api.put(`/v1/painel/usuarios/${editando.id}/perfis`, { perfis: editando.perfis });
      setEditando(null);
      usuarios.recarregar();
    } catch (err) {
      setEditando({ ...editando, erro: mensagemDoErro(err) });
    }
  }

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <h1 className="text-2xl font-bold text-gray-900">Usuários do painel</h1>
      <Aviso texto={usuarios.erro} />
      <Tabela cabecalho={["Nome", "Login", "Perfis", ""]}>
        {usuarios.itens.map((u) => (
          <tr key={u.id}>
            <td className="py-2 pr-4 font-medium">{u.nome}</td>
            <td className="py-2 pr-4">{u.login}</td>
            <td className="py-2 pr-4">
              {u.perfis.map((p) => `${ROTULOS_PERFIL[p.perfil]} (${nomeDaUnidade(p.unidadeId)})`).join(", ")}
            </td>
            <td className="py-2">
              <Button variant="ghost" size="sm" onClick={() => setEditando({ id: u.id, perfis: u.perfis, erro: null })}>
                Perfis
              </Button>
            </td>
          </tr>
        ))}
      </Tabela>
      {editando ? (
        <Cartao titulo={`Perfis de ${usuarios.itens.find((u) => u.id === editando.id)?.nome ?? ""}`}>
          <EditorDePerfis
            perfis={editando.perfis}
            unidades={unidades}
            mudar={(p) => setEditando({ ...editando, perfis: p })}
            erros={{}}
          />
          <Aviso texto={editando.erro} />
          <div className="flex gap-2">
            <Button onClick={salvarPerfis}>Salvar perfis</Button>
            <Button variant="ghost" onClick={() => setEditando(null)}>
              Cancelar
            </Button>
          </div>
        </Cartao>
      ) : null}
      <Cartao titulo="Novo usuário">
        <form onSubmit={criar} className="flex flex-col gap-3">
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
                onChange={(e) => setV({ ...v, login: e.target.value })}
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
          <EditorDePerfis perfis={perfis} unidades={unidades} mudar={setPerfis} erros={erros.campos} />
          <Aviso texto={erros.geral} />
          <Aviso texto={ok} tipo="ok" />
          <Button type="submit" className="self-start">
            Criar usuário
          </Button>
        </form>
      </Cartao>
    </div>
  );
}
