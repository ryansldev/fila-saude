import { describe, expect, it } from "vitest";
import type { EstadoEntrada } from "../src/contratos.ts";
import { contarAtivas, mudarModoServico, podeMudarExigeTriagem } from "../src/servico.ts";
import { congelar } from "./fixtures.ts";

type E = { id: string; estado: EstadoEntrada; vagaSegura: boolean; sessaoAbriu: boolean };
const e = (id: string, estado: EstadoEntrada, extra: Partial<E> = {}): E =>
  congelar({ id, estado, vagaSegura: false, sessaoAbriu: false, ...extra });

describe("mudarModoServico", () => {
  it("RN-ENC-07: troca para regulado bloqueada com entradas ativas, com a contagem", () => {
    const entradas = congelar([
      e("a", "aguardando"),
      e("b", "na_fila"),
      e("c", "arquivada"),
      e("d", "concluida"),
      e("f", "cancelada"),
      e("g", "encerrada_sem_atendimento"),
    ]);
    expect(mudarModoServico("livre", "regulado", entradas)).toEqual({ ok: false, erro: "servico_regulado" });
    expect(mudarModoServico("requisicao", "regulado", entradas)).toEqual({ ok: false, erro: "servico_regulado" });
    expect(contarAtivas(entradas)).toBe(2);
    expect(contarAtivas([e("x", "concluida"), e("y", "arquivada")])).toBe(0);
  });

  it("RN-ENC-07: arquivadas são canceladas com push", () => {
    const entradas = congelar([e("a", "arquivada"), e("b", "concluida"), e("c", "arquivada")]);
    const r = mudarModoServico("requisicao", "regulado", entradas);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.estado.mudancas).toEqual([
      { id: "a", para: "cancelada", push: true },
      { id: "c", para: "cancelada", push: true },
    ]);
    expect(entradas[0]?.estado).toBe("arquivada");
  });

  it("RN-ENC-07: aguardando encaminhamento vira aguardando ao virar livre", () => {
    const entradas = congelar([e("a", "aguardando_encaminhamento"), e("b", "aguardando"), e("c", "alocada")]);
    const r = mudarModoServico("requisicao", "livre", entradas);
    expect(r.ok && r.estado.mudancas).toEqual([{ id: "a", para: "aguardando", push: false }]);
  });

  it("RN-ENC-07: vaga segura vira confirmada com push antes da abertura", () => {
    const entradas = congelar([
      e("a", "aguardando_encaminhamento", { vagaSegura: true }),
      e("b", "aguardando_encaminhamento", { vagaSegura: true, sessaoAbriu: true }),
    ]);
    const r = mudarModoServico("requisicao", "livre", entradas);
    expect(r.ok && r.estado.mudancas).toEqual([
      { id: "a", para: "confirmada", push: true },
      { id: "b", para: "aguardando", push: false },
    ]);
  });

  it("AD-038: livre para requisição não exige foto de quem já está na lista", () => {
    const entradas = congelar([e("a", "aguardando"), e("b", "confirmada", { vagaSegura: true }), e("c", "arquivada")]);
    const r = mudarModoServico("livre", "requisicao", entradas);
    expect(r.ok && r.estado.mudancas).toEqual([]);
  });

  it("RN-ENC-07: mesmo modo não muda nada", () => {
    const r = mudarModoServico("requisicao", "requisicao", [e("a", "aguardando_encaminhamento")]);
    expect(r.ok && r.estado.mudancas).toEqual([]);
  });
});

describe("podeMudarExigeTriagem", () => {
  it("RN-TRI-01: exige triagem não muda com sessão aberta", () => {
    expect(podeMudarExigeTriagem([])).toBe(true);
    expect(podeMudarExigeTriagem([{ estado: "planejada" }, { estado: "encerrada" }, { estado: "cancelada" }])).toBe(
      true,
    );
    expect(podeMudarExigeTriagem([{ estado: "planejada" }, { estado: "aberta" }])).toBe(false);
  });
});
