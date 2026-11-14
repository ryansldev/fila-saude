import { describe, expect, it } from "vitest";
import {
  acoesDaFila,
  botoesDePresenca,
  cronometro,
  estacoesQueOpera,
  ordenarFila,
  rotuloDoEstado,
  textoDasPendencias,
  textoDoDocumento,
} from "@/lib/fila";

const item = (senha: string, estado: string) => ({ senha, estado });

describe("fila do dia no painel (T3.4, T3.7)", () => {
  it("botões pela matriz e pela unidade do perfil (PD-38)", () => {
    const gerente = [{ perfil: "gerente_ubs" as const, unidadeId: "u1" }];
    const recepcao = [{ perfil: "recepcao" as const, unidadeId: "u1" }];
    expect(acoesDaFila(gerente, "u1", "planejada")).toEqual({ abrir: true, encerrar: false, presenca: false });
    expect(acoesDaFila(gerente, "u1", "aberta")).toEqual({ abrir: false, encerrar: true, presenca: false });
    expect(acoesDaFila(gerente, "u2", "planejada").abrir).toBe(false);
    expect(acoesDaFila(recepcao, "u1", "aberta")).toEqual({ abrir: false, encerrar: false, presenca: true });
    expect(acoesDaFila(recepcao, "u1", "planejada").presenca).toBe(false);
  });

  it("ordem da tela: chamado, na unidade, remotos, depois os que saíram; pela senha", () => {
    const ordem = ordenarFila([
      item("C-004", "atendido_na_etapa"),
      item("C-003", "remoto"),
      item("C-002", "presente"),
      item("C-001", "remoto"),
      item("C-005", "chamado"),
    ]).map((i) => i.senha);
    expect(ordem).toEqual(["C-005", "C-002", "C-001", "C-003", "C-004"]);
  });

  it("textos dos estados e o cronômetro da chamada (AD-006)", () => {
    expect(rotuloDoEstado("remoto")).toBe("A caminho");
    expect(rotuloDoEstado("presente")).toBe("Na unidade");
    expect(rotuloDoEstado("saiu_da_fila")).toBe("Saiu da fila");
    const em = "2026-11-12T12:00:00.000Z";
    expect(cronometro(em, Date.parse(em) + 65_000)).toBe("01:05");
    expect(cronometro(em, Date.parse(em) - 1000)).toBe("00:00");
  });

  it("RN-FILA-05: pendências do QR recusado em texto para a recepção; sem pendência, nada", () => {
    expect(textoDasPendencias(["conta"])).toBe("Passe na recepção: conferir a conta");
    expect(textoDasPendencias(["pessoa_atendida", "prioridade"])).toBe(
      "Passe na recepção: conferir a pessoa atendida, a prioridade",
    );
    expect(textoDasPendencias([])).toBeNull();
  });
});

describe("presença pela recepção (RN-PRES-03, RN-FILA-05), revisão 2026-11-13", () => {
  it("qualquer remoto pode ter a presença marcada; com pendência, conferindo os documentos; 'não confere' sempre com motivo", () => {
    expect(botoesDePresenca({ estado: "remoto", pendencias: [] }, true)).toEqual({
      marcar: "Marcar presença",
      naoConfere: false,
    });
    expect(botoesDePresenca({ estado: "remoto", pendencias: ["conta"] }, true)).toEqual({
      marcar: "Conferir documentos e marcar presença",
      naoConfere: true,
    });
    expect(botoesDePresenca({ estado: "presente", pendencias: [] }, true)).toBeNull();
    expect(botoesDePresenca({ estado: "remoto", pendencias: [] }, false)).toBeNull();
  });

  it("CPF mascarado e nascimento em dd/mm/aaaa para comparar com o documento", () => {
    expect(textoDoDocumento({ nascimento: "1990-05-05", cpf: "•••.982.247-••" })).toBe(
      "nasc. 05/05/1990 · CPF •••.982.247-••",
    );
    expect(textoDoDocumento({ nascimento: "1990-05-05", cpf: null })).toBe("nasc. 05/05/1990 · sem CPF");
  });
});

describe("estação: só as que o perfil opera (PD-46), revisão 2026-11-13", () => {
  const ests = [
    { id: "t1", nome: "Triagem", etapa: "triagem" as const },
    { id: "a1", nome: "Sala 1", etapa: "atendimento" as const },
  ];
  it("técnico só triagem; enfermeiro as duas; perfil de outra unidade, nenhuma", () => {
    expect(estacoesQueOpera(ests, [{ perfil: "tecnico_enfermagem", unidadeId: "u1" }], "u1").map((e) => e.id)).toEqual([
      "t1",
    ]);
    expect(estacoesQueOpera(ests, [{ perfil: "enfermeiro", unidadeId: "u1" }], "u1").map((e) => e.id)).toEqual([
      "t1",
      "a1",
    ]);
    expect(estacoesQueOpera(ests, [{ perfil: "enfermeiro", unidadeId: "u2" }], "u1")).toEqual([]);
  });
});
