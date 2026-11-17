// @vitest-environment node
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { speechWithoutSession, styledQr } from "@/lib/qr";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

async function read(svg: string, px: number): Promise<string | null> {
  const { readBarcodes } = await import("zxing-wasm/reader");
  const { data, info } = await sharp(Buffer.from(svg), { density: 300 })
    .resize(px, px)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const r = await readBarcodes(
    { data: new Uint8ClampedArray(data), width: info.width, height: info.height, colorSpace: "srgb" },
    { formats: ["QRCode"] },
  );
  return r[0]?.text ?? null;
}

describe("QR de entrada estilizado (design system)", () => {
  const short = "filasaude://check-in?u=exemplo&t=abc123";
  const long = `filasaude://check-in?u=exemplo&t=${"x".repeat(90)}`;

  it("pontos pretos e só o coração em azul", () => {
    const svg = styledQr(short);
    expect(svg).toContain("#111313");
    expect(svg).toContain("#1a73c8");
    expect(svg).not.toContain("#185b9a");
  });

  it("um leitor de QR lê o código, grande e pequeno, curto e longo", async () => {
    expect(long.length).toBeGreaterThanOrEqual(120);
    for (const content of [short, long]) {
      for (const px of [600, 160])
        expect(await read(styledQr(content), px), `${content.length} @ ${px}px`).toBe(content);
    }
  }, 30_000);
});

describe("tela do paciente sem sessão aberta", () => {
  it("o Dr. Lino diz quando a fila abre, ou que hoje não tem", () => {
    expect(speechWithoutSession("2026-11-16T16:00:00.000Z", "America/Sao_Paulo")).toBe("a fila abre às 13:00.");
    expect(speechWithoutSession(null, "America/Sao_Paulo")).toBe("hoje não tem atendimento por aqui.");
  });
});
