import orchestrator from "tests/orchestrator";

export const UNIDADE = {
  nome: "UBS Centro",
  tipo: "ubs",
  endereco: "Rua A, 1",
  lat: -23.5,
  lng: -46.6,
  fuso: "America/Sao_Paulo",
  horario: { "1": [{ abre: "07:00", fecha: "17:00" }] },
};

// Município com gestor logado e uma unidade criada pela rota.
export async function municipioComUnidade() {
  const { slug } = await orchestrator.criarMunicipio();
  const gestor = await orchestrator.loginGestor(slug);
  const r = await orchestrator.pedirPainel(slug, "POST", "/v1/painel/unidades", { cookie: gestor, corpo: UNIDADE });
  if (r.status !== 201) throw new Error(`unidade: ${r.status} ${JSON.stringify(r.corpo)}`);
  return { slug, gestor, unidadeId: r.corpo.id as string };
}

// Usuário criado pelo gestor pela rota e já logado.
export async function usuarioLogado(
  slug: string,
  gestor: string,
  login: string,
  perfis: { perfil: string; unidadeId: string | null }[],
) {
  const senha = "senha-forte-1";
  const r = await orchestrator.pedirPainel(slug, "POST", "/v1/painel/usuarios", {
    cookie: gestor,
    corpo: { login, nome: login, senha, perfis },
  });
  if (r.status !== 201) throw new Error(`usuário ${login}: ${r.status} ${JSON.stringify(r.corpo)}`);
  return { id: r.corpo.id as string, cookie: await orchestrator.loginPainel(slug, login, senha) };
}
