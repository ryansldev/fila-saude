import { type Entrada, instanteParaLocal, localParaInstante, type Perfil, type Respostas } from "@fila-saude/domain";
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
import { contextoDoUsuario, executarAcao } from "infra/painel/acao";
import { origemDoPainel } from "infra/painel/origem";
import { criarTenant } from "infra/tenant/criar";
import { derrubarTenant } from "infra/tenant/derrubar";
import { bancoDoSlug } from "infra/tenant/slug";
import { Pool } from "pg";

export const SENHA_EXEMPLO = "exemplo123";
const FUSO = "America/Sao_Paulo";

export type ResumoExemplo = {
  painel: string;
  usuarios: { id: string; perfil: Perfil; login: string; senha: string }[];
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

const PERFIS_DA_UNIDADE = ["admin", "agendador", "recepcao", "triagem", "profissional"] as const;

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

// PD-40 / PD-41: o município de exemplo, cada passo pela função de serviço e por quem faz aquilo no produto.
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
    const usuarios: ResumoExemplo["usuarios"] = [
      { id: gestorId, perfil: "gestor", login: "gestor", senha: SENHA_EXEMPLO },
    ];
    const nomes: Record<string, string> = {
      admin: "Admin Exemplo",
      agendador: "Agendador Exemplo",
      recepcao: "Recepção Exemplo",
      triagem: "Triagem Exemplo",
      profissional: "Profissional Exemplo",
    };
    for (const perfil of PERFIS_DA_UNIDADE) {
      const u = await criarUsuario(comoGestor, {
        login: perfil,
        nome: nomes[perfil] as string,
        senha: SENHA_EXEMPLO,
        perfis: [{ perfil, unidadeId: ubs.id }],
      });
      usuarios.push({ id: u.id, perfil, login: perfil, senha: SENHA_EXEMPLO });
    }
    const idDe = (login: string) => usuarios.find((u) => u.login === login)?.id as string;

    // Como admin: serviços, estações e sessões.
    const comoAdmin = await contextoDoUsuario(db, idDe("admin"), agora);
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
    const manha = { ini: amanha(agora, "08:00"), fim: amanha(agora, "12:00") };
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
    for (const p of PACIENTES) {
      const pacienteId = await cadastrarPaciente(central, p);
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
        { servico: clinico.nome, visibilidade: "publica", inicioLocal: manha.ini.local },
        { servico: odonto.nome, visibilidade: "privada", inicioLocal: tarde.ini.local },
      ],
    };
  } finally {
    await pool.end();
  }
}
