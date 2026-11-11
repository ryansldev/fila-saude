import { describe, expect, it } from "vitest";
import { type ConfigParcial, configEfetiva, validarConfig } from "../src/configuracao.ts";
import { CONFIG_PADRAO } from "../src/fila.ts";

describe("configEfetiva", () => {
  it("modelo: unidade sem valor herda do município; município sem valor herda o padrão", () => {
    const c = configEfetiva({
      municipio: { janelaK: 3, toleranciaMin: 8 },
      unidade: { toleranciaMin: 10 },
    });
    expect(c.toleranciaMin).toBe(10);
    expect(c.janelaK).toBe(3);
    expect(c.qrSegundos).toBe(CONFIG_PADRAO.qrSegundos);
  });

  it("modelo: nulo herda como ausente", () => {
    const c = configEfetiva({
      municipio: { janelaK: 3 },
      unidade: { janelaK: null } as unknown as ConfigParcial,
    });
    expect(c.janelaK).toBe(3);
  });

  it("modelo: origem diz de onde veio cada valor", () => {
    const c = configEfetiva({
      municipio: { janelaK: 3, soVinculados: true },
      unidade: { toleranciaMin: 10 },
    });
    expect(c.origem.toleranciaMin).toBe("unidade");
    expect(c.origem.janelaK).toBe("municipio");
    expect(c.origem.soVinculados).toBe("municipio");
    expect(c.origem.qrSegundos).toBe("padrao");
    expect(c.origem.exigePreCadastro).toBe("padrao");
  });

  it("AD-053: pré-cadastro ligado por padrão; vínculo e uma unidade por vez desligados", () => {
    const c = configEfetiva({ municipio: {}, unidade: {} });
    expect(c.exigePreCadastro).toBe(true);
    expect(c.soVinculados).toBe(false);
    expect(c.umaUnidadePorVez).toBe(false);
    expect(c.fuso).toBe(CONFIG_PADRAO.fuso);
  });

  it("modelo: false explícito na unidade vence o município", () => {
    const c = configEfetiva({
      municipio: { exigePreCadastro: true },
      unidade: { exigePreCadastro: false },
    });
    expect(c.exigePreCadastro).toBe(false);
    expect(c.origem.exigePreCadastro).toBe("unidade");
  });
});

const ruim = (p: ConfigParcial, campo: string) => {
  const r = validarConfig(p);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(Object.keys(r.campos)).toContain(campo);
};
const bom = (p: ConfigParcial) => expect(validarConfig(p)).toEqual({ ok: true });

describe("validarConfig", () => {
  it("L-004: K 0 recusado e 1 aceito", () => {
    ruim({ janelaK: 0 }, "janelaK");
    bom({ janelaK: 1 });
  });
  it("L-004: tolerância 0 recusada e 1 aceita", () => {
    ruim({ toleranciaMin: 0 }, "toleranciaMin");
    bom({ toleranciaMin: 1 });
  });
  it("L-004: saia de casa 0 recusado e 1 aceito", () => {
    ruim({ saiaDeCasaMin: 0 }, "saiaDeCasaMin");
    bom({ saiaDeCasaMin: 1 });
  });
  it("L-004: QR 9/10 e 300/301", () => {
    ruim({ qrSegundos: 9 }, "qrSegundos");
    bom({ qrSegundos: 10 });
    bom({ qrSegundos: 300 });
    ruim({ qrSegundos: 301 }, "qrSegundos");
  });
  it("L-004: destaque da TV 2/3 e 60/61", () => {
    ruim({ destaqueTvSegundos: 2 }, "destaqueTvSegundos");
    bom({ destaqueTvSegundos: 3 });
    bom({ destaqueTvSegundos: 60 });
    ruim({ destaqueTvSegundos: 61 }, "destaqueTvSegundos");
  });
  it("L-004: prazo de confirmação 0 recusado e 1 aceito", () => {
    ruim({ prazoConfirmacaoHoras: 0 }, "prazoConfirmacaoHoras");
    bom({ prazoConfirmacaoHoras: 1 });
  });
  it("L-004: faltas e dias 0 recusados e 1 aceitos", () => {
    ruim({ alertaFaltas: { faltas: 0, dias: 1 } }, "alertaFaltas");
    ruim({ alertaFaltas: { faltas: 1, dias: 0 } }, "alertaFaltas");
    bom({ alertaFaltas: { faltas: 1, dias: 1 } });
  });
  it("L-004: fuso America/Sao_Paulo aceito e Brasil/Recife recusado", () => {
    bom({ fuso: "America/Sao_Paulo" });
    ruim({ fuso: "Brasil/Recife" }, "fuso");
  });
  it("modelo: número não inteiro recusado e vazio é válido", () => {
    ruim({ janelaK: 1.5 }, "janelaK");
    bom({});
  });
  it("modelo: junta os erros de vários campos", () => {
    const r = validarConfig({ janelaK: 0, qrSegundos: 5 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.campos).sort()).toEqual(["janelaK", "qrSegundos"]);
  });
});
