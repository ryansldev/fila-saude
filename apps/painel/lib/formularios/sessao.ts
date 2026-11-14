import { instanteParaLocal, localParaInstante } from "@fila-saude/domain";

export type Visibilidade = "publica" | "privada";

/** Data e hora digitadas no fuso da unidade → instante ISO (PD-26). */
export function horarioParaEnvio(data: string, hora: string, fuso: string): string {
  return new Date(localParaInstante(`${data}T${hora}`, fuso)).toISOString();
}

export function horarioParaTela(iso: string, fuso: string): { data: string; hora: string } {
  const local = instanteParaLocal(Date.parse(iso), fuso);
  return { data: local.slice(0, 10), hora: local.slice(11, 16) };
}

/** RN-PUB-03: privada perde a dispensa. */
export function ajustarVisibilidade(
  atual: { visibilidade: Visibilidade; dispensaPreCadastro: boolean },
  para: Visibilidade,
): { visibilidade: Visibilidade; dispensaPreCadastro: boolean } {
  return { visibilidade: para, dispensaPreCadastro: para === "publica" ? atual.dispensaPreCadastro : false };
}

/** Serviço regulado só tem sessão privada. */
export function visibilidadesPermitidas(modo: string): Visibilidade[] {
  return modo === "regulado" ? ["privada"] : ["publica", "privada"];
}

export function estacoesDoServico<E extends { servicos: string[] }>(estacoes: E[], servicoId: string): E[] {
  return estacoes.filter((e) => e.servicos.includes(servicoId));
}

/** Hoje (AAAA-MM-DD) no fuso da unidade. */
export function hojeNoFuso(fuso: string, agora = Date.now()): string {
  return instanteParaLocal(agora, fuso).slice(0, 10);
}

/** Intervalo [00:00 do dia, 00:00 do dia seguinte) no fuso, em ISO. */
export function intervaloDoDia(data: string, fuso: string): { de: string; ate: string } {
  const [a, m, d] = data.split("-").map(Number) as [number, number, number];
  const seguinte = new Date(Date.UTC(a, m - 1, d + 1)).toISOString().slice(0, 10);
  return { de: horarioParaEnvio(data, "00:00", fuso), ate: horarioParaEnvio(seguinte, "00:00", fuso) };
}

/** Vagas digitadas: vazio = sem limite; senão inteiro ≥ 1 (antes "1,5" ou "dez" viravam sem limite). */
export function lerVagas(texto: string): { ok: true; vagas: number | null } | { ok: false; erro: string } {
  const t = texto.trim();
  if (!t) return { ok: true, vagas: null };
  if (!/^\d+$/.test(t) || Number(t) < 1)
    return { ok: false, erro: "Use um número inteiro (1 ou mais), ou deixe vazio." };
  return { ok: true, vagas: Number(t) };
}

/** AAAA-MM-DD de verdade: o campo de data do navegador aceita anos com 5 ou 6 dígitos. */
export function diaValido(dia: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dia) && !Number.isNaN(Date.parse(`${dia}T00:00:00Z`));
}
