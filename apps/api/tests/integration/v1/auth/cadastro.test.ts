import { erroSchema } from "@fila-saude/schemas/erros";
import { sql } from "drizzle-orm";
import database from "infra/database";
import webserver from "infra/webserver";
import orchestrator, { type DadosDoCadastro } from "tests/orchestrator";
import { beforeAll, describe, expect, it } from "vitest";

const MENSAGEM_CPF_EM_USO = "Procure a recepção da sua unidade para contestar.";

type LinhaDoPaciente = {
  id: string;
  cpf: string;
  username: string;
  email: string;
  nome: string;
  nascimento: string;
  telefone: string;
  verificado_em: Date | null;
  verificado_metodo: string | null;
  verificado_municipio: string | null;
};

async function pacientesComCpf(cpf: string) {
  const resultado = await database.execute<LinhaDoPaciente>(sql`
    select id, cpf, username, email, name as nome, nascimento::text as nascimento, telefone,
      verificado_em, verificado_metodo, verificado_municipio
    from paciente where cpf = ${cpf}
  `);
  return resultado.rows;
}

function mascarar(cpf: string) {
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
}

// Troca o último dígito verificador: o CPF continua com 11 dígitos, mas fica inválido.
function cpfComVerificadorErrado(cpf: string) {
  const ultimo = Number(cpf.at(-1));
  return `${cpf.slice(0, 10)}${(ultimo + 1) % 10}`;
}

beforeAll(async () => {
  await orchestrator.waitForAllServices();
});

describe("POST /v1/auth/sign-up/email (cadastro do paciente)", () => {
  it("RN-ID-01: cadastro com CPF válido cria conta", async () => {
    const dados = orchestrator.dadosDeCadastro({ cpf: mascarar(orchestrator.gerarCpf()) });
    const cpf = dados.cpf.replace(/\D/g, "");

    const resposta = await orchestrator.cadastrarPaciente(dados);

    expect(resposta.status).toBe(200);
    expect(orchestrator.cookiesDe(resposta)).toContain("better-auth.session_token=");
    const corpo = (await resposta.json()) as { user: Record<string, unknown> };
    expect(corpo.user).toMatchObject({ email: dados.email, name: dados.nome, cpf, username: cpf });

    const linhas = await pacientesComCpf(cpf);
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({
      cpf,
      username: cpf,
      email: dados.email,
      nome: dados.nome,
      nascimento: dados.nascimento,
      telefone: "11987654321",
    });
  });

  it("RN-ID-01: CPF inválido → 400 cpf_invalido", async () => {
    const resposta = await orchestrator.cadastrarPaciente(
      orchestrator.dadosDeCadastro({ cpf: cpfComVerificadorErrado(orchestrator.gerarCpf()) }),
    );

    expect(resposta.status).toBe(400);
    expect(await resposta.json()).toEqual({ erro: "cpf_invalido" });
  });

  it("RN-ID-01: CPF com 10 e 12 dígitos → 400 cpf_invalido; com 11 válidos, cria", async () => {
    const cpf = orchestrator.gerarCpf();

    const curto = await orchestrator.cadastrarPaciente(orchestrator.dadosDeCadastro({ cpf: cpf.slice(0, 10) }));
    expect(curto.status).toBe(400);
    expect(await curto.json()).toEqual({ erro: "cpf_invalido" });

    const longo = await orchestrator.cadastrarPaciente(orchestrator.dadosDeCadastro({ cpf: `${cpf}0` }));
    expect(longo.status).toBe(400);
    expect(await longo.json()).toEqual({ erro: "cpf_invalido" });

    const certo = await orchestrator.cadastrarPaciente(orchestrator.dadosDeCadastro({ cpf }));
    expect(certo.status).toBe(200);
  });

  it("RN-ID-02: CPF já usado → 409 cpf_em_uso com orientação da recepção", async () => {
    const cpf = orchestrator.gerarCpf();
    const primeira = await orchestrator.cadastrarPaciente(orchestrator.dadosDeCadastro({ cpf }));
    expect(primeira.status).toBe(200);

    for (const mesmoCpf of [cpf, mascarar(cpf)]) {
      const resposta = await orchestrator.cadastrarPaciente(orchestrator.dadosDeCadastro({ cpf: mesmoCpf }));
      expect(resposta.status).toBe(409);
      expect(await resposta.json()).toEqual({ erro: "cpf_em_uso", mensagem: MENSAGEM_CPF_EM_USO });
    }

    expect(await pacientesComCpf(cpf)).toHaveLength(1);
  });

  it("RN-ID-02: dois cadastros simultâneos do mesmo CPF → exatamente um cria e o outro recebe 409", async () => {
    const cpf = orchestrator.gerarCpf();

    const respostas = await Promise.all([
      orchestrator.cadastrarPaciente(orchestrator.dadosDeCadastro({ cpf })),
      orchestrator.cadastrarPaciente(orchestrator.dadosDeCadastro({ cpf: mascarar(cpf) })),
    ]);

    const status = respostas.map((resposta) => resposta.status).sort();
    expect(status).toEqual([200, 409]);
    const recusada = respostas.find((resposta) => resposta.status === 409);
    expect(await recusada?.json()).toEqual({ erro: "cpf_em_uso", mensagem: MENSAGEM_CPF_EM_USO });
    expect(await pacientesComCpf(cpf)).toHaveLength(1);
  });

  it("RN-ID-01: e-mail é obrigatório", async () => {
    const { email: _email, ...semEmail } = orchestrator.dadosDeCadastro();

    const resposta = await orchestrator.cadastrarPaciente(semEmail);

    expect(resposta.status).toBe(400);
    const corpo = erroSchema.parse(await resposta.json());
    expect(corpo.erro).toBe("entrada_invalida");
    expect(Object.keys(corpo.campos ?? {})).toEqual(["email"]);
    expect(await pacientesComCpf(semEmail.cpf)).toHaveLength(0);
  });

  it("RN-ID-04: senha com 7 caracteres é recusada; com 8, aceita", async () => {
    const curta = await orchestrator.cadastrarPaciente(orchestrator.dadosDeCadastro({ senha: "1234567" }));
    expect(curta.status).toBe(400);
    const corpo = erroSchema.parse(await curta.json());
    expect(corpo.erro).toBe("entrada_invalida");
    expect(Object.keys(corpo.campos ?? {})).toEqual(["senha"]);

    const minima = await orchestrator.cadastrarPaciente(orchestrator.dadosDeCadastro({ senha: "12345678" }));
    expect(minima.status).toBe(200);
  });

  it("PD-23: telefone e nascimento são validados", async () => {
    const amanha = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const casos: Array<[Partial<DadosDoCadastro>, string]> = [
      [{ telefone: "123456789" }, "telefone"],
      [{ telefone: "(11) 9876-543210" }, "telefone"],
      [{ nascimento: "17/05/1990" }, "nascimento"],
      [{ nascimento: amanha }, "nascimento"],
    ];

    for (const [campo, chave] of casos) {
      const resposta = await orchestrator.cadastrarPaciente(orchestrator.dadosDeCadastro(campo));
      expect(resposta.status).toBe(400);
      const corpo = erroSchema.parse(await resposta.json());
      expect(corpo.erro).toBe("entrada_invalida");
      expect(Object.keys(corpo.campos ?? {})).toEqual([chave]);
    }
  });

  it("RN-ID-05: conta nasce não verificada", async () => {
    const dados = orchestrator.dadosDeCadastro();

    const resposta = await orchestrator.cadastrarPaciente(dados);

    expect(resposta.status).toBe(200);
    const [linha] = await pacientesComCpf(dados.cpf);
    expect(linha?.verificado_em).toBeNull();
    expect(linha?.verificado_metodo).toBeNull();
    expect(linha?.verificado_municipio).toBeNull();
  });

  it("RN-ID-05: cliente não consegue mandar verificadoEm", async () => {
    const dados = orchestrator.dadosDeCadastro();

    const resposta = await orchestrator.cadastrarPaciente({
      ...dados,
      verificadoEm: new Date().toISOString(),
      verificadoMetodo: "presencial",
      verificadoMunicipio: "00000000-0000-4000-8000-000000000000",
      verificado_em: new Date().toISOString(),
    });

    expect(resposta.status).toBe(200);
    const [linha] = await pacientesComCpf(dados.cpf);
    expect(linha?.verificado_em).toBeNull();
    expect(linha?.verificado_metodo).toBeNull();
    expect(linha?.verificado_municipio).toBeNull();
  });

  it("RN-ID-02: o paciente não troca o CPF da conta depois do cadastro", async () => {
    const dados = orchestrator.dadosDeCadastro();
    const cadastro = await orchestrator.cadastrarPaciente(dados);
    expect(cadastro.status).toBe(200);
    const outroCpf = orchestrator.gerarCpf();

    for (const corpo of [{ username: outroCpf }, { displayUsername: outroCpf }, { cpf: outroCpf }]) {
      const resposta = await fetch(`${webserver.origin}/v1/auth/update-user`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: webserver.origin,
          cookie: orchestrator.cookiesDe(cadastro),
        },
        body: JSON.stringify(corpo),
      });
      expect(resposta.status).toBe(400);
      expect(erroSchema.parse(await resposta.json()).erro).toBe("entrada_invalida");
    }

    const [linha] = await pacientesComCpf(dados.cpf);
    expect(linha?.username).toBe(dados.cpf);
    expect(await pacientesComCpf(outroCpf)).toHaveLength(0);
  });

  it("RN-ID-05: o paciente não marca a própria conta como verificada pelo update-user", async () => {
    const dados = orchestrator.dadosDeCadastro();
    const cadastro = await orchestrator.cadastrarPaciente(dados);
    expect(cadastro.status).toBe(200);
    const casos: Array<[string, unknown]> = [
      ["verificadoEm", new Date().toISOString()],
      ["verificadoMetodo", "presencial"],
      ["verificadoMunicipio", "00000000-0000-4000-8000-000000000000"],
    ];

    for (const [campo, valor] of casos) {
      const resposta = await atualizarPaciente(orchestrator.cookiesDe(cadastro), { [campo]: valor });
      expect(resposta.status).toBe(400);
      expect(await resposta.json()).toEqual({ erro: "entrada_invalida", campos: { [campo]: ["campo_imutavel"] } });
    }

    const [linha] = await pacientesComCpf(dados.cpf);
    expect(linha?.verificado_em).toBeNull();
    expect(linha?.verificado_metodo).toBeNull();
    expect(linha?.verificado_municipio).toBeNull();
  });

  it("PD-23: update-user valida telefone e nascimento como o cadastro", async () => {
    const dados = orchestrator.dadosDeCadastro();
    const cadastro = await orchestrator.cadastrarPaciente(dados);
    expect(cadastro.status).toBe(200);
    const cookie = orchestrator.cookiesDe(cadastro);
    const amanha = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const casos: Array<[Record<string, unknown>, string]> = [
      [{ telefone: "123" }, "telefone"],
      [{ telefone: 11987654321 }, "telefone"],
      [{ nascimento: "1990-13-45" }, "nascimento"],
      [{ nascimento: amanha }, "nascimento"],
    ];

    for (const [corpo, chave] of casos) {
      const resposta = await atualizarPaciente(cookie, corpo);
      expect(resposta.status).toBe(400);
      const erro = erroSchema.parse(await resposta.json());
      expect(erro.erro).toBe("entrada_invalida");
      expect(Object.keys(erro.campos ?? {})).toEqual([chave]);
    }

    const valida = await atualizarPaciente(cookie, { telefone: "(21) 3456-7890", nascimento: "1985-01-02" });
    expect(valida.status).toBe(200);
    const [linha] = await pacientesComCpf(dados.cpf);
    expect(linha).toMatchObject({ telefone: "2134567890", nascimento: "1985-01-02" });
  });

  it("PD-22: e-mail já usado por outra conta → 409 email_em_uso", async () => {
    const primeira = orchestrator.dadosDeCadastro();
    expect((await orchestrator.cadastrarPaciente(primeira)).status).toBe(200);

    const resposta = await orchestrator.cadastrarPaciente(orchestrator.dadosDeCadastro({ email: primeira.email }));

    expect(resposta.status).toBe(409);
    expect(await resposta.json()).toEqual({ erro: "email_em_uso" });
  });

  it("PD-22: erros do próprio better-auth saem em português (senha curta, sem sessão, credenciais)", async () => {
    const dados = orchestrator.dadosDeCadastro();
    const cadastro = await orchestrator.cadastrarPaciente(dados);
    expect(cadastro.status).toBe(200);

    const senhaCurta = await chamarAuth("/change-password", {
      cookie: orchestrator.cookiesDe(cadastro),
      corpo: { currentPassword: dados.senha, newPassword: "1234567" },
    });
    expect(senhaCurta.status).toBe(400);
    expect(await senhaCurta.json()).toEqual({ erro: "entrada_invalida", campos: { senha: ["senha_curta"] } });

    const semSessao = await atualizarPaciente("", { nome: "Outra" });
    expect(semSessao.status).toBe(401);
    expect(await semSessao.json()).toEqual({ erro: "nao_autenticado" });

    const senhaErrada = await chamarAuth("/sign-in/email", {
      corpo: { email: dados.email, password: "senha-errada-1" },
    });
    expect(senhaErrada.status).toBe(401);
    expect(await senhaErrada.json()).toEqual({ erro: "credenciais_invalidas" });
  });

  it("PD-22: is-username-available não existe (não revela se o CPF tem conta)", async () => {
    const dados = orchestrator.dadosDeCadastro();
    expect((await orchestrator.cadastrarPaciente(dados)).status).toBe(200);

    const resposta = await chamarAuth("/is-username-available", { corpo: { username: dados.cpf } });

    expect(resposta.status).toBe(404);
    expect(await resposta.json()).toEqual({ erro: "nao_encontrado" });
  });
});

function chamarAuth(caminho: string, { cookie, corpo }: { cookie?: string; corpo: unknown }) {
  return fetch(`${webserver.origin}/v1/auth${caminho}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: webserver.origin, ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(corpo),
  });
}

function atualizarPaciente(cookie: string, corpo: unknown) {
  return chamarAuth("/update-user", { cookie, corpo });
}
