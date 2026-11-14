const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type QrLido = { municipio: string; unidadeId: string; tokens: string[] };

/**
 * Lê o link do QR de entrada (`filasaude://check-in?m=<slug>&u=<unidade>&t=<tok1>,<tok2>`). Parse à mão:
 * o `URL` do React Native não garante `searchParams` para esquema próprio.
 */
export function lerQr(conteudo: string): QrLido | null {
  const m = /^filasaude:\/\/check-in\?(.+)$/.exec(conteudo.trim());
  if (!m?.[1]) return null;
  const params = new Map<string, string>();
  for (const par of m[1].split("&")) {
    const [k, v = ""] = par.split("=");
    if (k) params.set(k, decodeURIComponent(v));
  }
  return deParametros({ m: params.get("m"), u: params.get("u"), t: params.get("t") });
}

/** Os mesmos dados quando o link abriu o app direto (parâmetros da rota). */
export function deParametros(p: {
  m?: string | undefined;
  u?: string | undefined;
  t?: string | undefined;
}): QrLido | null {
  const tokens = (p.t ?? "").split(",").filter(Boolean);
  if (!p.m || !p.u || !UUID.test(p.u) || tokens.length === 0) return null;
  return { municipio: p.m, unidadeId: p.u, tokens };
}

type Resultado = { pessoa: string; senha: string; resultado: "presente" | "pendencia" | "ja_na_unidade" };

const RECEPCAO = "passe na recepção para confirmar seus documentos. você ainda não entrou na fila da unidade.";

/** RN-PRES-01 / RN-FILA-05: o que o app diz depois de ler o QR. */
export function textoDoCheckIn(lista: Resultado[]): { ok: boolean; linhas: string[] } {
  if (lista.length === 0) return { ok: false, linhas: ["você não tem senha aberta nesta unidade agora."] };
  const linhas = lista.map((r) => {
    const quem = `${r.pessoa} (${r.senha})`;
    if (r.resultado === "pendencia") return `${quem}: ${RECEPCAO}`;
    if (r.resultado === "ja_na_unidade") return `${quem}: você já está na fila da unidade.`;
    return `${quem}: você está na unidade. fique de olho na TV e no celular.`;
  });
  return { ok: lista.every((r) => r.resultado !== "pendencia"), linhas };
}
