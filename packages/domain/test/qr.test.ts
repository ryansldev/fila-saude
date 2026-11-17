import { describe, expect, it } from "vitest";
import { tokenQr, validateQr } from "../src/qr.ts";

const NOW = 1_700_000_000_000;
const STEP = 30_000;

describe("tokenQr", () => {
  it("RN-PRES-01: tem 16 caracteres base64url e é determinístico", async () => {
    const t = await tokenQr("segredo-a", NOW);
    expect(t).toMatch(/^[A-Za-z0-9_-]{16}$/);
    expect(await tokenQr("segredo-a", NOW)).toBe(t);
  });

  it("RN-PRES-01: muda a cada janela e entre segredos", async () => {
    const t = await tokenQr("segredo-a", NOW);
    expect(await tokenQr("segredo-a", NOW + STEP)).not.toBe(t);
    expect(await tokenQr("segredo-b", NOW)).not.toBe(t);
  });
});

describe("validateQr", () => {
  it("RN-PRES-01: aceita só a janela atual e a anterior", async () => {
    const current = await tokenQr("s", NOW);
    const previous = await tokenQr("s", NOW - STEP);
    const old = await tokenQr("s", NOW - 2 * STEP);
    expect(await validateQr(["s"], current, NOW)).toBe(0);
    expect(await validateQr(["s"], previous, NOW)).toBe(0);
    expect(await validateQr(["s"], old, NOW)).toBeNull();
  });

  it("RN-TV-03: qualquer sessão aberta da unidade aceita o código da TV", async () => {
    const tv = await tokenQr("s1", NOW);
    expect(await validateQr(["s2", "s1"], tv, NOW)).toBe(1);
  });

  it("RN-PRES-01: token de outra unidade é recusado", async () => {
    const other = await tokenQr("other", NOW);
    expect(await validateQr(["s1", "s2"], other, NOW)).toBeNull();
    expect(await validateQr([], other, NOW)).toBeNull();
  });

  it("RN-PRES-01: respeita intervalo customizado", async () => {
    const t = await tokenQr("s", NOW, 10_000);
    expect(await validateQr(["s"], t, NOW + 10_000, 10_000)).toBe(0);
    expect(await validateQr(["s"], t, NOW + 20_000, 10_000)).toBeNull();
  });
});
