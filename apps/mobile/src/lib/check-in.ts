const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ReadQr = { municipality: string; unitId: string; tokens: string[] };

/**
 * Lê o link do QR de entrada (`filasaude://check-in?m=<slug>&u=<unidade>&t=<tok1>,<tok2>`). Parse à mão:
 * o `URL` do React Native não garante `searchParams` para esquema próprio.
 */
export function readQr(content: string): ReadQr | null {
  const m = /^filasaude:\/\/check-in\?(.+)$/.exec(content.trim());
  if (!m?.[1]) return null;
  const params = new Map<string, string>();
  for (const pair of m[1].split("&")) {
    const [k, v = ""] = pair.split("=");
    if (!k) continue;
    try {
      params.set(k, decodeURIComponent(v));
    } catch {
      return null; // codificação quebrada: outro QR qualquer, não o da unidade
    }
  }
  return fromParameters({ m: params.get("m"), u: params.get("u"), t: params.get("t") });
}

/** Os mesmos dados quando o link abriu o app direto (parâmetros da rota). */
export function fromParameters(p: {
  m?: string | undefined;
  u?: string | undefined;
  t?: string | undefined;
}): ReadQr | null {
  const tokens = (p.t ?? "").split(",").filter(Boolean);
  if (!p.m || !p.u || !UUID.test(p.u) || tokens.length === 0) return null;
  return { municipality: p.m, unitId: p.u, tokens };
}

type Result = { person: string; ticket: string; result: "present" | "pending_check" | "already_in_unit" | "called" };

const RECEPTION = "passe na recepção para confirmar seus documentos. você ainda não entrou na fila da unidade.";

/** RN-PRES-01 / RN-FILA-05: o que o app diz depois de ler o QR. */
export function checkInText(list: Result[]): {
  kind: "present" | "reception" | "no_ticket";
  rows: string[];
  /** A faixa grande quando alguém precisa passar na recepção (só quem tem pendência). */
  banner?: { title: string; text: string };
} {
  if (list.length === 0) return { kind: "no_ticket", rows: ["você não tem senha aberta nesta unidade agora."] };
  const rows = list.map((r) => {
    const forWhom = `${r.person} (${r.ticket})`;
    if (r.result === "pending_check") return `${forWhom}: ${RECEPTION}`;
    if (r.result === "already_in_unit") return `${forWhom}: você já está na fila da unidade.`;
    if (r.result === "called") return `${forWhom}: você já foi chamado. vá para a sala indicada na TV.`;
    return `${forWhom}: você está na unidade. fique de olho na TV e no celular.`;
  });
  const pending = list.filter((r) => r.result === "pending_check").length;
  if (pending === 0) return { kind: "present", rows };
  const banner =
    pending === list.length
      ? {
          title: "passe na recepção",
          text: "para confirmar seus documentos. você ainda não entrou na fila da unidade.",
        }
      : {
          title: "passe na recepção com quem tem pendência",
          text: "quem aparece abaixo com pendência ainda não entrou na fila da unidade; os outros já entraram.",
        };
  return { kind: "reception", rows, banner };
}
