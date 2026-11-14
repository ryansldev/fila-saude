import { describe, expect, it } from "vitest";
import { lerQr, textoDoCheckIn } from "@/lib/check-in";

const U = "11111111-1111-4111-8111-111111111111";

describe("check-in pelo QR no app (RN-PRES-01)", () => {
  it("lê o link do QR da unidade; outro QR qualquer é recusado", () => {
    expect(lerQr(`filasaude://check-in?m=exemplo&u=${U}&t=aaa,bbb`)).toEqual({
      municipio: "exemplo",
      unidadeId: U,
      tokens: ["aaa", "bbb"],
    });
    expect(lerQr("https://exemplo.com")).toBeNull();
    expect(lerQr("filasaude://check-in?m=exemplo")).toBeNull();
    expect(lerQr("qualquer coisa")).toBeNull();
  });

  it("RN-FILA-05: resultado em texto, com a orientação da recepção para quem tem pendência", () => {
    expect(textoDoCheckIn([{ pessoa: "Ana", senha: "V-001", resultado: "presente" }])).toEqual({
      ok: true,
      linhas: ["Ana (V-001): você está na unidade. fique de olho na TV e no celular."],
    });
    expect(textoDoCheckIn([{ pessoa: "Bia", senha: "V-002", resultado: "pendencia" }])).toEqual({
      ok: false,
      linhas: [
        "Bia (V-002): passe na recepção para confirmar seus documentos. você ainda não entrou na fila da unidade.",
      ],
    });
    expect(textoDoCheckIn([])).toEqual({ ok: false, linhas: ["você não tem senha aberta nesta unidade agora."] });
  });
});
