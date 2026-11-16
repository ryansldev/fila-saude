import { instanteParaLocal } from "@fila-saude/domain";
import QRCode from "qrcode";

const PRETO = "#111313";

const MARGEM = 2;
const CORACAO =
  '<path fill="#1a73c8" d="M12 21s-7.5-4.6-9.6-9.4C.9 8.2 3 4.5 6.6 4.5c2.1 0 3.5 1.1 5.4 3.1 1.9-2 3.3-3.1 5.4-3.1 3.6 0 5.7 3.7 4.2 7.1C19.5 16.4 12 21 12 21z"/><path fill="#fff" d="M11 9h2v3h3v2h-3v3h-2v-3H8v-2h3z"/>';

/**
 * QR de entrada do design system: pontos redondos pretos, os três cantos arredondados e o coração
 * da marca (azul) no centro. Correção H, para o coração não atrapalhar a leitura.
 */
export function qrEstilizado(conteudo: string): string {
  const qr = QRCode.create(conteudo, { errorCorrectionLevel: "H" });
  const n = qr.modules.size;
  const lado = n + 2 * MARGEM;
  const canto = (x: number, y: number) => (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
  const c0 = Math.floor(n / 2) - 3;
  const c1 = Math.floor(n / 2) + 3;
  const partes: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lado} ${lado}" role="img" aria-label="QR de entrada">`,
    `<rect width="${lado}" height="${lado}" fill="#fff"/>`,
  ];
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      if (!qr.modules.get(x, y) || canto(x, y) || (x >= c0 && x <= c1 && y >= c0 && y <= c1)) continue;
      partes.push(`<circle cx="${x + MARGEM + 0.5}" cy="${y + MARGEM + 0.5}" r=".43" fill="${PRETO}"/>`);
    }
  for (const [fx, fy] of [
    [0, 0],
    [n - 7, 0],
    [0, n - 7],
  ] as const) {
    const X = fx + MARGEM;
    const Y = fy + MARGEM;
    partes.push(
      `<rect x="${X + 0.5}" y="${Y + 0.5}" width="6" height="6" rx="1.8" fill="none" stroke="${PRETO}" stroke-width="1"/>`,
      `<rect x="${X + 2}" y="${Y + 2}" width="3" height="3" rx="1" fill="${PRETO}"/>`,
    );
  }
  const centro = MARGEM + n / 2;
  partes.push(
    `<rect x="${centro - 3.4}" y="${centro - 3.4}" width="6.8" height="6.8" rx="1.8" fill="#fff"/>`,
    `<g transform="translate(${centro - 2.6},${centro - 2.6}) scale(.2167)">${CORACAO}</g>`,
    "</svg>",
  );
  return partes.join("");
}

/** O que o Dr. Lino diz na tela do paciente quando não há sessão aberta (em minúsculas, como no app). */
export function falaSemSessao(proximaAbertura: string | null, fuso: string): string {
  if (!proximaAbertura) return "hoje não tem atendimento por aqui.";
  return `a fila abre às ${instanteParaLocal(Date.parse(proximaAbertura), fuso).slice(11, 16)}.`;
}
