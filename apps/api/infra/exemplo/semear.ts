import {
  type Atribuicoes,
  type Entrada,
  FUNCOES,
  type Funcao,
  instanteParaLocal,
  localParaInstante,
  OCUPACOES,
  type Ocupacao,
  type Respostas,
} from "@fila-saude/domain";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { authCentral } from "infra/auth/central";
import { criarEstacao } from "infra/config/estacoes";
import { criarServico } from "infra/config/servicos";
import { criarSessao } from "infra/config/sessoes";
import { criarUnidade } from "infra/config/unidades";
import { criarUsuario } from "infra/config/usuarios";
import type { Db } from "infra/database";
import { paciente } from "infra/database/central/schema/auth";
import { type DbDoTenant, schemaMunicipal } from "infra/database/tenants";
import env from "infra/env";
import { entrarNaLista, type PessoaInformada } from "infra/fila/entradas";
import { inscrever } from "infra/fila/inscricao";
import { type ContextoDaAcao, contextoDoUsuario, executarAcao } from "infra/painel/acao";
import { origemDoPainel } from "infra/painel/origem";
import { criarTenant } from "infra/tenant/criar";
import { derrubarTenant } from "infra/tenant/derrubar";
import { bancoDoSlug } from "infra/tenant/slug";
import { Pool } from "pg";

export const SENHA_EXEMPLO = "exemplo123";
const FUSO = "America/Sao_Paulo";

export type ResumoExemplo = {
  painel: string;
  usuarios: { id: string; papel: string; login: string; senha: string }[];
  pacientes: { nome: string; cpf: string; senha: string }[];
  sessoes: { servico: string; visibilidade: "publica" | "privada"; inicioLocal: string }[];
};

const PACIENTES = [
  { nome: "Ana Souza", cpf: "52998224725", nascimento: "1958-04-02", email: "ana.souza@exemplo.com.br", grupos: [] },
  { nome: "Bruno Lima", cpf: "11144477735", nascimento: "1992-08-15", email: "bruno.lima@exemplo.com.br", grupos: [] },
  {
    nome: "Carla Dias",
    cpf: "39053344705",
    nascimento: "1996-01-20",
    email: "carla.dias@exemplo.com.br",
    grupos: ["gestante"],
  },
] as const;

export const CPFS_DE_EXEMPLO = PACIENTES.map((p) => p.cpf);

const respostas = (grupos: readonly string[]): Respostas =>
  ({ alarmes: [], motivo: "acompanhamento", gravidade: null, condicoes: [], grupos }) as unknown as Respostas;

// "Amanhã" = dia seguinte ao de `agora` no fuso da unidade.
function amanha(agora: number, hora: string): { instante: number; local: string } {
  const hoje = instanteParaLocal(agora, FUSO).slice(0, 10);
  const [a, m, d] = hoje.split("-").map(Number) as [number, number, number];
  const dia = new Date(Date.UTC(a, m - 1, d + 1)).toISOString().slice(0, 10);
  const local = `${dia}T${hora}`;
  return { instante: localParaInstante(local, FUSO), local };
}

// Hora cheia de `agora` no fuso da unidade (sessão "de agora" da fatia 1).
function horaCheia(agora: number): { instante: number; local: string } {
  const local = `${instanteParaLocal(agora, FUSO).slice(0, 13)}:00`;
  return { instante: localParaInstante(local, FUSO), local };
}

// PD-40: cadastro pelo handler real do better-auth central, com o e-mail já confirmado.
async function cadastrarPaciente(central: Db, p: (typeof PACIENTES)[number]): Promise<string> {
  const resposta = await authCentral.handler(
    new Request(`${env.CENTRAL_URL}/v1/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: env.CENTRAL_URL },
      body: JSON.stringify({
        cpf: p.cpf,
        nome: p.nome,
        email: p.email,
        telefone: "11987654321",
        nascimento: p.nascimento,
        senha: SENHA_EXEMPLO,
      }),
    }),
  );
  if (resposta.status !== 200) throw new Error(`cadastro de ${p.nome}: ${resposta.status} ${await resposta.text()}`);
  const { user } = (await resposta.json()) as { user: { id: string } };
  await central.update(paciente).set({ emailVerified: true }).where(eq(paciente.id, user.id));
  return user.id;
}

// PD-40 / PD-41: o município de exemplo, cada passo pela função de serviço e por quem faz aquilo no produto
// (a SMS cria a unidade, a regulação e o gerente; o gerente cadastra a equipe e configura a UBS).
export async function semearExemplo(deps: {
  central: Db;
  template: string;
  agora: number;
  slug?: string;
}): Promise<ResumoExemplo> {
  const slug = deps.slug ?? "exemplo";
  const { central, template, agora } = deps;

  await central.delete(paciente).where(inArray(paciente.cpf, CPFS_DE_EXEMPLO));
  await derrubarTenant(slug, { central });
  const { gestorId } = await criarTenant(
    {
      slug,
      nome: "Município Exemplo",
      uf: "SP",
      gestor: { login: "gestor", nome: "Gestora Exemplo", senha: SENHA_EXEMPLO },
    },
    { central, template },
  );
  if (!gestorId) throw new Error("gestor não criado");

  const pool = new Pool({ connectionString: template.replace("{banco}", bancoDoSlug(slug)), max: 2 });
  pool.on("error", () => {});
  const db = drizzle(pool, { schema: schemaMunicipal }) as DbDoTenant;
  try {
    // Como gestor: a unidade e os usuários.
    const comoGestor = await contextoDoUsuario(db, gestorId, agora);
    const ubs = await criarUnidade(comoGestor, {
      nome: "UBS Centro",
      tipo: "ubs",
      cnes: null,
      endereco: { cep: "01001000", logradouro: "Rua das Flores", numero: "100", complemento: null, bairro: "Centro" },
      lat: -23.5505,
      lng: -46.6333,
      fuso: FUSO,
      horario: Object.fromEntries(["1", "2", "3", "4", "5"].map((d) => [d, [{ abre: "07:00", fecha: "17:00" }]])),
      config: {},
    });
    // Unidades vizinhas, para o mapa e a lista "perto de você" do app (tela 5); sem sessões.
    const vizinhas = [
      {
        nome: "UBS Vila Nova",
        tipo: "ubs" as const,
        rua: "Rua Augusta",
        numero: "850",
        bairro: "Consolação",
        lat: -23.5531,
        lng: -46.6528,
      },
      {
        nome: "UBS Jardim das Flores",
        tipo: "ubs" as const,
        rua: "Rua Vergueiro",
        numero: "1200",
        bairro: "Liberdade",
        lat: -23.5647,
        lng: -46.6383,
      },
      {
        nome: "Policlínica Sul",
        tipo: "policlinica" as const,
        rua: "Avenida Paulista",
        numero: "2000",
        bairro: "Bela Vista",
        lat: -23.5613,
        lng: -46.6565,
      },
    ];
    for (const v of vizinhas) {
      await criarUnidade(comoGestor, {
        nome: v.nome,
        tipo: v.tipo,
        cnes: null,
        endereco: { cep: "01310100", logradouro: v.rua, numero: v.numero, complemento: null, bairro: v.bairro },
        lat: v.lat,
        lng: v.lng,
        fuso: FUSO,
        horario: Object.fromEntries(["1", "2", "3", "4", "5"].map((d) => [d, [{ abre: "07:00", fecha: "17:00" }]])),
        config: {},
      });
    }
    const usuarios: ResumoExemplo["usuarios"] = [
      { id: gestorId, papel: FUNCOES.gestao_sms.rotulo, login: "gestor", senha: SENHA_EXEMPLO },
    ];
    const cadastrar = async (ctx: ContextoDaAcao, login: string, nome: string, papel: string, a: Atribuicoes) => {
      const u = await criarUsuario(ctx, { login, nome, senha: SENHA_EXEMPLO, ...a });
      usuarios.push({ id: u.id, papel, login, senha: SENHA_EXEMPLO });
      return u.id;
    };
    const so = (funcao: Funcao, unidadeId: string | null): Atribuicoes => ({
      vinculos: [],
      funcoes: [{ funcao, unidadeId }],
    });
    const ocupacao = (o: Ocupacao, ...funcoes: Funcao[]): Atribuicoes => ({
      vinculos: [{ unidadeId: ubs.id, ocupacao: o }],
      funcoes: funcoes.map((funcao) => ({ funcao, unidadeId: ubs.id })),
    });

    // A SMS cadastra a regulação e o gerente da UBS (RN-PERF-04).
    await cadastrar(
      comoGestor,
      "regulacao",
      "Regulação Exemplo",
      FUNCOES.regulacao_sms.rotulo,
      so("regulacao_sms", null),
    );
    const gerenteId = await cadastrar(
      comoGestor,
      "gerente",
      "Gerente Exemplo",
      FUNCOES.gerente_ubs.rotulo,
      so("gerente_ubs", ubs.id),
    );

    // O gerente cadastra a equipe da própria unidade.
    const comoGerente = await contextoDoUsuario(db, gerenteId, agora);
    const equipe: [string, string, Ocupacao, Funcao[]][] = [
      ["recepcao", "Recepção Exemplo", "recepcao", ["agendar"]],
      ["enfermeira", "Enfermeira Exemplo", "enfermeiro", []],
      ["tecnica", "Técnica de Enfermagem Exemplo", "tecnico_enfermagem", []],
      ["medica", "Médica Exemplo", "medico", []],
      ["dentista", "Dentista Exemplo", "cirurgiao_dentista", []],
    ];
    for (const [login, nome, o, funcoes] of equipe) {
      const rotulo = [OCUPACOES[o].rotulo, ...funcoes.map((f) => FUNCOES[f].rotulo)].join(" + ");
      await cadastrar(comoGerente, login, nome, rotulo, ocupacao(o, ...funcoes));
    }
    const idDe = (login: string) => usuarios.find((u) => u.login === login)?.id as string;

    // Como gerente: serviços, estações e sessões.
    const comoAdmin = comoGerente;
    const clinico = await criarServico(comoAdmin, ubs.id, {
      nome: "Clínico geral",
      prefixo: "C",
      exigeTriagem: true,
      modo: "livre",
      tempoMedioMin: { triagem: 5, atendimento: 15 },
    });
    const odonto = await criarServico(comoAdmin, ubs.id, {
      nome: "Odontologia",
      prefixo: "O",
      exigeTriagem: false,
      modo: "livre",
      tempoMedioMin: { atendimento: 20 },
    });
    const curativos = await criarServico(comoAdmin, ubs.id, {
      nome: "Curativos",
      prefixo: "V",
      exigeTriagem: false,
      modo: "livre",
      tempoMedioMin: { atendimento: 10 },
    });
    const triagem1 = await criarEstacao(comoAdmin, ubs.id, {
      nome: "Triagem 1",
      etapa: "triagem",
      servicos: [clinico.id],
    });
    const consultorio1 = await criarEstacao(comoAdmin, ubs.id, {
      nome: "Consultório 1",
      etapa: "atendimento",
      servicos: [clinico.id],
    });
    const consultorio2 = await criarEstacao(comoAdmin, ubs.id, {
      nome: "Consultório 2",
      etapa: "atendimento",
      servicos: [odonto.id],
    });
    const procedimentos = await criarEstacao(comoAdmin, ubs.id, {
      nome: "Sala de procedimentos",
      etapa: "atendimento",
      servicos: [curativos.id],
    });
    const manha = { ini: amanha(agora, "08:00"), fim: amanha(agora, "12:00") };
    // Fatia 1: sessão pública "de agora" (4 h) para abrir no painel e chamar na estação.
    const deAgora = horaCheia(agora);
    const sessaoDeAgora = await criarSessao(comoAdmin, ubs.id, {
      servicoId: curativos.id,
      inicio: new Date(deAgora.instante).toISOString(),
      fim: new Date(deAgora.instante + 4 * 3600_000).toISOString(),
      vagas: 10,
      visibilidade: "publica",
      dispensaPreCadastro: false,
      profissional: "Enf. Carla",
      estacoes: [procedimentos.id],
    });
    const tarde = { ini: amanha(agora, "13:00"), fim: amanha(agora, "17:00") };
    await criarSessao(comoAdmin, ubs.id, {
      servicoId: clinico.id,
      inicio: new Date(manha.ini.instante).toISOString(),
      fim: new Date(manha.fim.instante).toISOString(),
      vagas: 20,
      visibilidade: "publica",
      dispensaPreCadastro: false,
      profissional: "Dra. Helena",
      estacoes: [triagem1.id, consultorio1.id],
    });
    await criarSessao(comoAdmin, ubs.id, {
      servicoId: odonto.id,
      inicio: new Date(tarde.ini.instante).toISOString(),
      fim: new Date(tarde.fim.instante).toISOString(),
      vagas: 4,
      visibilidade: "privada",
      dispensaPreCadastro: false,
      profissional: "Dr. Paulo",
      estacoes: [consultorio2.id],
    });

    // Pacientes: cadastro na central e entrada na lista pelo caminho do app (sem auditoria).
    const contas = new Map<string, string>();
    for (const p of PACIENTES) {
      const pacienteId = await cadastrarPaciente(central, p);
      contas.set(p.cpf, pacienteId);
      const pessoa: PessoaInformada = { nome: p.nome, nascimento: p.nascimento, cpf: p.cpf, pacienteId };
      const r = await entrarNaLista(db, {
        servicoId: odonto.id,
        pessoa,
        responsavelPacienteId: pacienteId,
        respostas: respostas(p.grupos),
        agora,
      });
      if (!r.ok) throw new Error(`entrada de ${p.nome}: ${r.erro}`);
    }

    // Ana e Bruno se inscrevem na sessão de agora pelo caminho do app (sem auditoria).
    for (const p of PACIENTES.slice(0, 2)) {
      const pacienteId = contas.get(p.cpf) as string;
      await inscrever(db, sessaoDeAgora.id, {
        pessoa: { nome: p.nome, nascimento: p.nascimento, cpf: p.cpf, pacienteId },
        responsavelPacienteId: pacienteId,
        respostas: respostas(p.grupos),
        agora,
      });
    }

    // Como recepção: a pessoa sem app.
    const comoRecepcao = await contextoDoUsuario(db, idDe("recepcao"), agora);
    await executarAcao<Entrada>(
      comoRecepcao,
      { acao: "criar_entrada", alvo: { tipo: "entrada", id: (e) => e.id }, unidadeId: ubs.id },
      async (tx) => {
        const r = await entrarNaLista(tx, {
          servicoId: odonto.id,
          pessoa: { nome: "José Pereira", nascimento: "1975-06-30", cpf: null, pacienteId: null },
          responsavelPacienteId: null,
          respostas: respostas([]),
          agora,
        });
        if (!r.ok) throw new Error(`entrada de José: ${r.erro}`);
        return r.estado;
      },
    );

    return {
      painel: `${origemDoPainel(slug)}/login`,
      usuarios,
      pacientes: PACIENTES.map((p) => ({ nome: p.nome, cpf: p.cpf, senha: SENHA_EXEMPLO })),
      sessoes: [
        { servico: curativos.nome, visibilidade: "publica", inicioLocal: deAgora.local },
        { servico: clinico.nome, visibilidade: "publica", inicioLocal: manha.ini.local },
        { servico: odonto.nome, visibilidade: "privada", inicioLocal: tarde.ini.local },
      ],
    };
  } finally {
    await pool.end();
  }
}
