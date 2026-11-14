// Token rotativo do QR (RN-PRES-01, RNF-SEG-01): HMAC-SHA-256 da janela de tempo.

const INTERVALO_PADRAO_MS = 30_000;
const TAMANHO_TOKEN = 16;

function base64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function tokenDaJanela(segredo: string, janela: number): Promise<string> {
  const enc = new TextEncoder();
  const chave = await globalThis.crypto.subtle.importKey(
    "raw",
    enc.encode(segredo),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await globalThis.crypto.subtle.sign("HMAC", chave, enc.encode(String(janela)));
  return base64url(new Uint8Array(mac)).slice(0, TAMANHO_TOKEN);
}

export function tokenQr(segredo: string, agora: number, intervaloMs = INTERVALO_PADRAO_MS): Promise<string> {
  return tokenDaJanela(segredo, Math.floor(agora / intervaloMs));
}

/** Índice da sessão cujo segredo gerou o token na janela atual ou na anterior; senão null. */
// Comparação em tempo constante: o tempo da resposta não diz quantos caracteres do token acertaram.
function iguais(a: string, b: string): boolean {
  let dif = a.length ^ b.length;
  for (let k = 0; k < a.length; k++) dif |= a.charCodeAt(k) ^ b.charCodeAt(k % Math.max(b.length, 1));
  return dif === 0;
}

export async function validarQr(
  segredos: string[],
  token: string,
  agora: number,
  intervaloMs = INTERVALO_PADRAO_MS,
): Promise<number | null> {
  const janela = Math.floor(agora / intervaloMs);
  for (const [i, segredo] of segredos.entries()) {
    for (const j of [janela, janela - 1]) {
      if (iguais(await tokenDaJanela(segredo, j), token)) return i;
    }
  }
  return null;
}
