import { describe, expect, it } from "vitest";
import { nascimentoSchema } from "../auth.ts";
import { inscricaoEntradaSchema, itemDaFilaSchema } from "../fila.ts";

const respostas = { alarmes: [], motivo: "acompanhamento", gravidade: null, condicoes: [], grupos: [] };
const outra = (dados: Record<string, unknown>) =>
  inscricaoEntradaSchema.safeParse({
    paraQuem: {
      tipo: "outra",
      nome: "Bia Reis",
      nascimento: "2018-03-03",
      cpf: null,
      relacao: "responsavel_legal",
      declarou: true,
      ...dados,
    },
    respostas,
  });

describe("inscrição para outra pessoa (AD-018), revisão 2026-11-13", () => {
  it("CPF opcional, mas quando vem precisa ser válido; sai só com dígitos", () => {
    expect(outra({}).success).toBe(true);
    expect(outra({ cpf: "123.456.789-00" }).success).toBe(false);
    expect(outra({ cpf: "111.111.111-11" }).success).toBe(false);
    const r = outra({ cpf: "390.533.447-05" });
    expect(r.success && r.data.paraQuem.tipo === "outra" && r.data.paraQuem.cpf).toBe("39053344705");
  });

  it("nascimento real, não no futuro e não mais de 130 anos atrás", () => {
    expect(outra({ nascimento: "2020-02-31" }).success).toBe(false);
    expect(outra({ nascimento: "2999-01-01" }).success).toBe(false);
    expect(nascimentoSchema.safeParse("1850-01-01").success).toBe(false);
    expect(nascimentoSchema.safeParse("1950-06-15").success).toBe(true);
  });
});

describe("a relação de quem inscreve outra pessoa (2026-11-16)", () => {
  it("outra pessoa exige a relação e a declaração", () => {
    expect(outra({ relacao: undefined }).success).toBe(false);
    expect(outra({ relacao: "vizinho" }).success).toBe(false);
    expect(outra({ declarou: false }).success).toBe(false);
    expect(outra({ declarou: undefined }).success).toBe(false);
    for (const relacao of ["responsavel_legal", "cuidador", "familiar_autorizado"])
      expect(outra({ relacao }).success).toBe(true);
  });

  it("para mim não pede relação", () => {
    expect(inscricaoEntradaSchema.safeParse({ paraQuem: { tipo: "eu" }, respostas }).success).toBe(true);
  });

  it("a Fila do dia diz quem inscreveu e a relação, ou nada quando foi a própria pessoa", () => {
    const item = {
      id: "i1",
      entradaId: "8f5b7c1e-2d3a-4b5c-9d6e-7f8a9b0c1d2e",
      senha: "A1",
      nome: "Bia Reis",
      etapa: "atendimento",
      estado: "remoto",
      pulos: 0,
      risco: "rotina",
      prioridade: false,
      estacaoId: null,
      pendencias: [],
      documento: { nascimento: "2018-03-03", cpf: null },
    };
    expect(itemDaFilaSchema.safeParse({ ...item, responsavel: null }).success).toBe(true);
    expect(itemDaFilaSchema.safeParse({ ...item, responsavel: { nome: "Bruno", relacao: "cuidador" } }).success).toBe(
      true,
    );
    expect(itemDaFilaSchema.safeParse(item).success).toBe(false);
    // Inscrita por outra conta antes de existir a relação: mostra quem inscreveu, sem a relação.
    expect(itemDaFilaSchema.safeParse({ ...item, responsavel: { nome: "Bruno", relacao: null } }).success).toBe(true);
  });
});
