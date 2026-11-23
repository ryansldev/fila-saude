import { noticeItem } from "infra/notices/outbox";
import { describe, expect, it } from "vitest";

describe("o item da fila na chave do aviso de chamada", () => {
  it("'sua vez' e rechamada levam o item", () => {
    expect(noticeItem("sua_vez:item-1:1700000000000")).toBe("item-1");
    expect(noticeItem("rechamada:item-2:1700000000000")).toBe("item-2");
  });

  it("outras chaves: nenhum", () => {
    expect(noticeItem("teste:123")).toBeNull();
    expect(noticeItem("pulado:item-1:1")).toBeNull();
  });
});
