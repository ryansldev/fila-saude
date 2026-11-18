// Token rotativo do QR (RN-PRES-01, RNF-SEG-01): HMAC-SHA-256 da janela de tempo.

const DEFAULT_INTERVAL_MS = 30_000;
const TOKEN_SIZE = 16;

function base64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function windowToken(secret: string, window: number): Promise<string> {
  const ref = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    ref.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await globalThis.crypto.subtle.sign("HMAC", key, ref.encode(String(window)));
  return base64url(new Uint8Array(mac)).slice(0, TOKEN_SIZE);
}

export function tokenQr(secret: string, now: number, intervalMs = DEFAULT_INTERVAL_MS): Promise<string> {
  return windowToken(secret, Math.floor(now / intervalMs));
}

/** Índice da sessão cujo segredo gerou o token na janela atual ou na anterior; senão null. */
// Comparação em tempo constante: o tempo da resposta não diz quantos caracteres do token acertaram.
function equal(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let k = 0; k < a.length; k++) diff |= a.charCodeAt(k) ^ b.charCodeAt(k % Math.max(b.length, 1));
  return diff === 0;
}

export async function validateQr(
  secrets: string[],
  token: string,
  now: number,
  intervalMs = DEFAULT_INTERVAL_MS,
): Promise<number | null> {
  const window = Math.floor(now / intervalMs);
  for (const [i, secret] of secrets.entries()) {
    for (const j of [window, window - 1]) {
      if (equal(await windowToken(secret, j), token)) return i;
    }
  }
  return null;
}
