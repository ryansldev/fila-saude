import type { Atribuicoes, Funcao, Ocupacao } from "@fila-saude/domain";
import orchestrator from "tests/orchestrator";

// Atribuições prontas para os testes (RN-PERF-04).
export const sms = (): Atribuicoes => ({ vinculos: [], funcoes: [{ funcao: "gestao_sms", unidadeId: null }] });
export const gerente = (unidadeId: string): Atribuicoes => ({
  vinculos: [],
  funcoes: [{ funcao: "gerente_ubs", unidadeId }],
});
export const ocupacao = (unidadeId: string, o: Ocupacao, ...funcoes: Funcao[]): Atribuicoes => ({
  vinculos: [{ unidadeId, ocupacao: o }],
  funcoes: funcoes.map((funcao) => ({ funcao, unidadeId })),
});

export const UNIDADE = {
  nome: "UBS Centro",
  tipo: "ubs",
  endereco: { cep: "01001-000", logradouro: "Praça da Sé", numero: "100", complemento: null, bairro: "Sé" },
  cnes: null,
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
export async function usuarioLogado(slug: string, gestor: string, login: string, atribuicoes: Atribuicoes) {
  const senha = "senha-forte-1";
  const r = await orchestrator.pedirPainel(slug, "POST", "/v1/painel/usuarios", {
    cookie: gestor,
    corpo: { login, nome: login, senha, ...atribuicoes },
  });
  if (r.status !== 201) throw new Error(`usuário ${login}: ${r.status} ${JSON.stringify(r.corpo)}`);
  return { id: r.corpo.id as string, cookie: await orchestrator.loginPainel(slug, login, senha) };
}
