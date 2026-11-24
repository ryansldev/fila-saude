import { type ZodType, z } from "zod";
import { ApiError } from "@/lib/api";

// Mensagens dos schemas em português, as mesmas da API.
z.config(z.locales.pt());

const MESSAGES: Record<string, string | ((e: ApiError) => string)> = {
  no_connection: "Sem conexão com o servidor. Tente de novo.",
  not_authenticated: "Sua sessão expirou. Entre de novo.",
  no_permission: "Você não tem permissão para isso.",
  not_found: "Não encontrado. Recarregue a página.",
  invalid_input: "Confira os campos destacados.",
  last_manager: "Este é o último gestor do município: ele não pode perder o perfil.",
  login_in_use: "Este login já está em uso.",
  prefix_in_use: "Este prefixo já está em uso nesta unidade.",
  session_open: "Há sessão aberta deste serviço. Espere ela encerrar.",
  service_in_triage_station: "Há estação de triagem ligada a este serviço. Tire o serviço dela antes.",
  service_has_entries: (e) =>
    `Este serviço tem ${String(e.data?.activeEntries ?? "algumas")} entradas ativas. O modo só muda sem entradas.`,
  regulated_service: "Serviço regulado não tem sessão pública.",
  station_busy: "A estação está aberta. Feche-a antes de arquivar.",
  outdated_version: "A sessão mudou desde que você abriu. Recarregue a página.",
  slots_below_taken: (e) => `As vagas não podem ficar abaixo das ${String(e.data?.taken ?? "")} já ocupadas.`,
  forbidden_transition: "Não dá para fazer isso no estado atual da sessão.",
  session_has_patients: "Há pacientes nesta sessão. Ela não pode ser cancelada agora.",
  unit_has_sessions: "A unidade tem sessões planejadas ou abertas. Cancele ou encerre antes de remover.",
  unit_has_entries: (e) =>
    `A unidade tem ${String(e.data?.activeEntries ?? "")} pacientes na lista de espera. Não dá para remover agora.`,
  remove_self: "Você não pode remover você mesmo da equipe.",
  station_has_call: "Há paciente chamado em uma estação. Finalize ou marque 'não compareceu' antes de encerrar.",
  station_paused: 'A estação está em pausa. Toque em "Voltar agora" para chamar de novo.',
  pause_back_before_start: "A volta precisa ser depois do início da pausa e de agora.",
  reason_required: "Escreva o motivo.",
  station_in_use: "A estação está em uma sessão planejada ou aberta. Tire-a dessas sessões antes.",
  session_closed: "Nenhuma sessão aberta para isso agora.",
  none_eligible: "Ninguém aguardando na unidade.",
  invalid_code: "Código não encontrado ou vencido. Confira o código que aparece na TV.",
  duplicate: "Já existe um registro igual. Recarregue a página.",
};

/** Texto para a pessoa a partir de qualquer erro da chamada. */
export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    // A API explica o caso quando sabe mais (ex.: "Essa pessoa já não está disponível"); o texto do
    // painel é a reserva para o mesmo código sem explicação.
    if (e.userMessage) return e.userMessage;
    const m = MESSAGES[e.error];
    if (typeof m === "function") return m(e);
    if (m) return m;
  }
  return "Não foi possível concluir. Tente de novo.";
}

export type SendingErrors = { general: string | null; fields: Record<string, string> };

/**
 * 400 com campos vira erro por campo; o resto, mensagem geral. Cada chave vale também para as
 * chaves "de cima" (`time.1.0.opens` aparece em `time.1.0`), para chegar a algum campo da tela;
 * erro na raiz (`_`) vira a mensagem geral.
 */
export function sendingErrors(e: unknown): SendingErrors {
  if (e instanceof ApiError && e.status === 400 && e.fields) {
    const fields: Record<string, string> = {};
    let general: string | null = null;
    for (const [k, v] of Object.entries(e.fields)) {
      const msg = v[0] ?? "inválido";
      if (k === "_") {
        general = msg;
        continue;
      }
      const parts = k.split(".");
      for (let n = parts.length; n >= 1; n--) {
        const key = parts.slice(0, n).join(".");
        if (!(key in fields)) fields[key] = msg;
      }
    }
    return { general, fields };
  }
  return { general: errorMessage(e), fields: {} };
}

/**
 * Valida no navegador com o mesmo schema da API, antes de enviar: o erro aparece no campo na hora,
 * sem ida ao servidor. `null` = pode enviar.
 */
export function validateClient(schema: ZodType, data: unknown): SendingErrors | null {
  const r = schema.safeParse(data);
  if (r.success) return null;
  const fields: Record<string, string[]> = {};
  for (const p of r.error.issues) {
    const key = p.path.length > 0 ? p.path.join(".") : "_";
    fields[key] = [...(fields[key] ?? []), p.message];
  }
  return sendingErrors(new ApiError(400, "invalid_input", undefined, fields));
}
