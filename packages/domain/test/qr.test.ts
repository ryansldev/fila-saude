import { describe, expect, it } from "vitest";
import { tokenQr, validarQr } from "../src/qr.ts";

const AGORA = 1_700_000_000_000;
const PASSO = 30_000;

describe("tokenQr", () => {
  it("RN-PRES-01: tem 16 caracteres base64url e é determinístico", async () => {
    const t = await tokenQr("segredo-a", AGORA);
    expect(t).toMatch(/^[A-Za-z0-9_-]{16}$/);
    expect(await tokenQr("segredo-a", AGORA)).toBe(t);
  });

  it("RN-PRES-01: muda a cada janela e entre segredos", async () => {
    const t = await tokenQr("segredo-a", AGORA);
    expect(await tokenQr("segredo-a", AGORA + PASSO)).not.toBe(t);
    expect(await tokenQr("segredo-b", AGORA)).not.toBe(t);
  });
});

describe("validarQr", () => {
  it("RN-PRES-01: aceita só a janela atual e a anterior", async () => {
    const atual = await tokenQr("s", AGORA);
    const anterior = await tokenQr("s", AGORA - PASSO);
    const antiga = await tokenQr("s", AGORA - 2 * PASSO);
    expect(await validarQr(["s"], atual, AGORA)).toBe(0);
    expect(await validarQr(["s"], anterior, AGORA)).toBe(0);
    expect(await validarQr(["s"], antiga, AGORA)).toBeNull();
  });

  it("RN-TV-03: qualquer sessão aberta da unidade aceita o código da TV", async () => {
    const tv = await tokenQr("s1", AGORA);
    expect(await validarQr(["s2", "s1"], tv, AGORA)).toBe(1);
  });

  it("RN-PRES-01: token de outra unidade é recusado", async () => {
    const outra = await tokenQr("outra", AGORA);
    expect(await validarQr(["s1", "s2"], outra, AGORA)).toBeNull();
    expect(await validarQr([], outra, AGORA)).toBeNull();
  });

  it("RN-PRES-01: respeita intervalo customizado", async () => {
    const t = await tokenQr("s", AGORA, 10_000);
    expect(await validarQr(["s"], t, AGORA + 10_000, 10_000)).toBe(0);
    expect(await validarQr(["s"], t, AGORA + 20_000, 10_000)).toBeNull();
  });
});
