import { noticeTarget } from "infra/notices/outbox";
import { describe, expect, it } from "vitest";

describe("o item da fila na chave do aviso", () => {
  it("'sua vez' e rechamada: o item chamado", () => {
    expect(noticeTarget("sua_vez:item-1:1700000000000")).toEqual({ kind: "call", item: "item-1" });
    expect(noticeTarget("rechamada:item-2:1700000000000")).toEqual({ kind: "call", item: "item-2" });
  });

  it("'saia de casa' e 'venha agora': o item e a etapa em que ele espera", () => {
    expect(noticeTarget("saia_de_casa:item-1:care")).toEqual({ kind: "waiting", item: "item-1", stage: "care" });
    expect(noticeTarget("venha_agora:item-1:triage:1700000000000")).toEqual({
      kind: "waiting",
      item: "item-1",
      stage: "triage",
    });
  });

  it("outras chaves: nenhum", () => {
    expect(noticeTarget("teste:123")).toBeNull();
    expect(noticeTarget("pulado:item-1:1")).toBeNull();
    expect(noticeTarget("fila_aberta:item-1")).toBeNull();
  });
});
