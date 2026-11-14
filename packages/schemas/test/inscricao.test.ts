import { describe, expect, it } from "vitest";
import { nascimentoSchema } from "../auth.ts";
import { inscricaoEntradaSchema } from "../fila.ts";

const respostas = { alarmes: [], motivo: "acompanhamento", gravidade: null, condicoes: [], grupos: [] };
const outra = (dados: Record<string, unknown>) =>
  inscricaoEntradaSchema.safeParse({
    paraQuem: { tipo: "outra", nome: "Bia Reis", nascimento: "2018-03-03", cpf: null, ...dados },
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
