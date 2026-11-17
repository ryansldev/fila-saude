import { describe, expect, it } from "vitest";
import { effectiveConfig, type PartialConfig, validateConfig } from "../src/configuration.ts";
import { DEFAULT_CONFIG } from "../src/queue.ts";

describe("effectiveConfig", () => {
  it("modelo: unidade sem valor herda do município; município sem valor herda o padrão", () => {
    const c = effectiveConfig({
      municipality: { windowK: 3, toleranceMin: 8 },
      unit: { toleranceMin: 10 },
    });
    expect(c.toleranceMin).toBe(10);
    expect(c.windowK).toBe(3);
    expect(c.qrSeconds).toBe(DEFAULT_CONFIG.qrSeconds);
  });

  it("modelo: nulo herda como ausente", () => {
    const c = effectiveConfig({
      municipality: { windowK: 3 },
      unit: { windowK: null } as unknown as PartialConfig,
    });
    expect(c.windowK).toBe(3);
  });

  it("modelo: origem diz de onde veio cada valor", () => {
    const c = effectiveConfig({
      municipality: { windowK: 3, onlyLinked: true },
      unit: { toleranceMin: 10 },
    });
    expect(c.origin.toleranceMin).toBe("unit");
    expect(c.origin.windowK).toBe("municipality");
    expect(c.origin.onlyLinked).toBe("municipality");
    expect(c.origin.qrSeconds).toBe("default");
    expect(c.origin.requiresPreRegistration).toBe("default");
  });

  it("AD-053: pré-cadastro ligado por padrão; vínculo e uma unidade por vez desligados", () => {
    const c = effectiveConfig({ municipality: {}, unit: {} });
    expect(c.requiresPreRegistration).toBe(true);
    expect(c.onlyLinked).toBe(false);
    expect(c.oneUnitAtATime).toBe(false);
    expect(c.timeZone).toBe(DEFAULT_CONFIG.timeZone);
  });

  it("modelo: false explícito na unidade vence o município", () => {
    const c = effectiveConfig({
      municipality: { requiresPreRegistration: true },
      unit: { requiresPreRegistration: false },
    });
    expect(c.requiresPreRegistration).toBe(false);
    expect(c.origin.requiresPreRegistration).toBe("unit");
  });
});

const bad = (p: PartialConfig, field: string) => {
  const r = validateConfig(p);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(Object.keys(r.fields)).toContain(field);
};
const good = (p: PartialConfig) => expect(validateConfig(p)).toEqual({ ok: true });

describe("validateConfig", () => {
  it("L-004: K 0 recusado e 1 aceito", () => {
    bad({ windowK: 0 }, "windowK");
    good({ windowK: 1 });
  });
  it("L-004: tolerância 0 recusada e 1 aceita", () => {
    bad({ toleranceMin: 0 }, "toleranceMin");
    good({ toleranceMin: 1 });
  });
  it("L-004: saia de casa 0 recusado e 1 aceito", () => {
    bad({ leaveHomeMin: 0 }, "leaveHomeMin");
    good({ leaveHomeMin: 1 });
  });
  it("L-004: QR 9/10 e 300/301", () => {
    bad({ qrSeconds: 9 }, "qrSeconds");
    good({ qrSeconds: 10 });
    good({ qrSeconds: 300 });
    bad({ qrSeconds: 301 }, "qrSeconds");
  });
  it("L-004: destaque da TV 2/3 e 60/61", () => {
    bad({ tvHighlightSeconds: 2 }, "tvHighlightSeconds");
    good({ tvHighlightSeconds: 3 });
    good({ tvHighlightSeconds: 60 });
    bad({ tvHighlightSeconds: 61 }, "tvHighlightSeconds");
  });
  it("L-004: prazo de confirmação 0 recusado e 1 aceito", () => {
    bad({ confirmationDeadlineHours: 0 }, "confirmationDeadlineHours");
    good({ confirmationDeadlineHours: 1 });
  });
  it("L-004: faltas e dias 0 recusados e 1 aceitos", () => {
    bad({ noShowAlert: { noShows: 0, days: 1 } }, "noShowAlert");
    bad({ noShowAlert: { noShows: 1, days: 0 } }, "noShowAlert");
    good({ noShowAlert: { noShows: 1, days: 1 } });
  });
  it("L-004: fuso America/Sao_Paulo aceito e Brasil/Recife recusado", () => {
    good({ timeZone: "America/Sao_Paulo" });
    bad({ timeZone: "Brasil/Recife" }, "timeZone");
  });
  it("modelo: número não inteiro recusado e vazio é válido", () => {
    bad({ windowK: 1.5 }, "windowK");
    good({});
  });
  it("modelo: junta os erros de vários campos", () => {
    const r = validateConfig({ windowK: 0, qrSeconds: 5 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.fields).sort()).toEqual(["qrSeconds", "windowK"]);
  });
});

describe("validarConfig: campos que quebravam a estimativa (revisão 2026-11-13)", () => {
  it("tempo médio inicial ≥ 1 min e ordem do município só risco ou prioridade", () => {
    expect(validateConfig({ initialAverageTimeMin: 0 }).ok).toBe(false);
    expect(validateConfig({ initialAverageTimeMin: -5 }).ok).toBe(false);
    good({ initialAverageTimeMin: 15 });
    expect(validateConfig({ municipalityOrder: "qualquer" as never }).ok).toBe(false);
    good({ municipalityOrder: "risk" });
  });
});
