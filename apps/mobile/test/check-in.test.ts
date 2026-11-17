import { describe, expect, it } from "vitest";
import { checkInText, readQr } from "@/lib/check-in";

const U = "11111111-1111-4111-8111-111111111111";

describe("check-in pelo QR no app (RN-PRES-01)", () => {
  it("lê o link do QR da unidade; outro QR qualquer é recusado", () => {
    expect(readQr(`filasaude://check-in?m=exemplo&u=${U}&t=aaa,bbb`)).toEqual({
      municipality: "exemplo",
      unitId: U,
      tokens: ["aaa", "bbb"],
    });
    expect(readQr("https://exemplo.com")).toBeNull();
    expect(readQr("filasaude://check-in?m=exemplo")).toBeNull();
    expect(readQr("qualquer coisa")).toBeNull();
  });

  it("RN-FILA-05: resultado em texto, com a orientação da recepção para quem tem pendência", () => {
    expect(checkInText([{ person: "Ana", ticket: "V-001", result: "present" }])).toEqual({
      kind: "present",
      rows: ["Ana (V-001): você está na unidade. fique de olho na TV e no celular."],
    });
    expect(checkInText([{ person: "Bia", ticket: "V-002", result: "pending_check" }])).toEqual({
      kind: "reception",
      rows: [
        "Bia (V-002): passe na recepção para confirmar seus documentos. você ainda não entrou na fila da unidade.",
      ],
    });
    // Sem senha aberta aqui não é "passe na recepção".
    expect(checkInText([])).toEqual({
      kind: "no_ticket",
      rows: ["você não tem senha aberta nesta unidade agora."],
    });
  });
});

describe("QR lido depois de chamado (revisão 2026-11-14)", () => {
  it("diz que já foi chamado e para ir à sala, sem mandar para a recepção", () => {
    expect(checkInText([{ person: "Ana", ticket: "V-001", result: "called" }])).toEqual({
      kind: "present",
      rows: ["Ana (V-001): você já foi chamado. vá para a sala indicada na TV."],
    });
  });
});
