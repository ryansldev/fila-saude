import { avisosSaiaDeCasa, type Evento, estimar } from "@fila-saude/domain";
import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";
import database from "infra/database";
import { dispositivoPush } from "infra/database/central/schema/push";
import { aviso } from "infra/database/municipal/schema/aviso";
import { sessao } from "infra/database/municipal/schema/sessao";
import type { DbDoTenant } from "infra/database/tenants";
import { naSessao } from "infra/fila/dia";

export type Envio = { para: string; titulo: string; corpo: string; dados: Record<string, string> };
export type ResultadoDoEnvio = { ok: true } | { ok: false; erro: string; tokenInvalido?: boolean };
/** Um resultado por envio, na mesma ordem. Trocável no teste. */
export type Enviador = (lista: Envio[]) => Promise<ResultadoDoEnvio[]>;

const MAX_TENTATIVAS = 5;
const LOTE = 100;

// RN-ETA-03 / RN-ORD-02: avisos que dependem do tempo; o domínio marca o "saia de casa" no dia
// e a chave da outbox impede o "venha agora" repetido. Uma varredura por município de cada vez.
async function gerarAvisosDoTempo(db: DbDoTenant, agora: number): Promise<void> {
  await db.transaction(async (tx) => {
    const trava = await tx.execute<{ ok: boolean }>(
      sql`select pg_try_advisory_xact_lock(hashtext('fila-saude:varredura')) as ok`,
    );
    if (!trava.rows[0]?.ok) return;
    const abertas = await tx.select({ id: sessao.id }).from(sessao).where(eq(sessao.estado, "aberta"));
    for (const { id } of abertas) {
      await naSessao(tx, id, async (c) => {
        if (!c.dia || c.dia.estado !== "aberta") return { resultado: null };
        const dia = c.dia;
        const venha: Evento[] = dia.itens
          .filter(
            (i) => i.estado === "remoto" && estimar(dia, i.id, agora, { modoManual: false }).tipo === "venha_agora",
          )
          .map((i) => ({
            tipo: "venha_agora",
            itemId: i.id,
            entradaId: i.entradaId,
            sessaoId: dia.sessaoId,
            dados: { etapa: i.etapa, em: agora },
          }));
        const saia = avisosSaiaDeCasa(dia, agora, { modoManual: false });
        // Quem já é o próximo recebe só o "venha agora".
        const eventos = [...venha, ...saia.eventos.filter((e) => !venha.some((v) => v.itemId === e.itemId))];
        if (eventos.length === 0) return { resultado: null };
        return { dia: saia.dia, eventos, resultado: null };
      });
    }
  });
}

// T2.4: envia os pendentes vencidos; quem não tem aparelho registrado fica "sem_dispositivo";
// falha volta com espera crescente (2, 4, 8, 16 min) até desistir.
async function enviarPendentes(db: DbDoTenant, agora: number, enviar: Enviador): Promise<void> {
  await db.transaction(async (tx) => {
    const pendentes = await tx
      .select()
      .from(aviso)
      .where(
        and(
          eq(aviso.estado, "pendente"),
          lte(aviso.proximaTentativaEm, sql`greatest(${new Date(agora).toISOString()}::timestamptz, now())`),
        ),
      )
      .orderBy(asc(aviso.criadoEm))
      .limit(LOTE)
      .for("update", { skipLocked: true });
    if (pendentes.length === 0) return;
    const contas = [...new Set(pendentes.map((a) => a.pacienteId))];
    const aparelhos = await database
      .select({ pacienteId: dispositivoPush.pacienteId, token: dispositivoPush.token })
      .from(dispositivoPush)
      .where(inArray(dispositivoPush.pacienteId, contas));

    const envios: { avisoId: string; envio: Envio }[] = [];
    for (const a of pendentes) {
      for (const d of aparelhos.filter((x) => x.pacienteId === a.pacienteId)) {
        envios.push({
          avisoId: a.id,
          envio: {
            para: d.token,
            titulo: a.titulo,
            corpo: a.corpo,
            dados: { tipo: a.tipo, entradaId: a.entradaId ?? "" },
          },
        });
      }
    }
    const resultados = envios.length > 0 ? await enviar(envios.map((e) => e.envio)) : [];
    const invalidos = envios.filter((_, i) => {
      const r = resultados[i];
      return r && !r.ok && r.tokenInvalido;
    });
    if (invalidos.length > 0) {
      await database.delete(dispositivoPush).where(
        inArray(
          dispositivoPush.token,
          invalidos.map((e) => e.envio.para),
        ),
      );
    }

    for (const a of pendentes) {
      const meus = envios.map((e, i) => ({ ...e, r: resultados[i] })).filter((e) => e.avisoId === a.id);
      if (meus.length === 0) {
        await tx.update(aviso).set({ estado: "sem_dispositivo" }).where(eq(aviso.id, a.id));
        continue;
      }
      if (meus.some((e) => e.r?.ok)) {
        await tx
          .update(aviso)
          .set({ estado: "enviado", enviadoEm: new Date(agora), tentativas: a.tentativas + 1 })
          .where(eq(aviso.id, a.id));
        continue;
      }
      const tentativas = a.tentativas + 1;
      const erro = meus.map((e) => (e.r && !e.r.ok ? e.r.erro : "sem resposta")).join("; ");
      await tx
        .update(aviso)
        .set({
          tentativas,
          ultimoErro: erro,
          estado: tentativas >= MAX_TENTATIVAS ? "falhou" : "pendente",
          proximaTentativaEm: new Date(agora + 2 ** tentativas * 60_000),
        })
        .where(eq(aviso.id, a.id));
    }
  });
}

export async function varrerMunicipio(db: DbDoTenant, agora: number, enviar: Enviador): Promise<void> {
  await gerarAvisosDoTempo(db, agora);
  await enviarPendentes(db, agora, enviar);
}

const URL_DA_EXPO = "https://exp.host/--/api/v2/push/send";

type TicketDaExpo = { status: "ok" | "error"; message?: string; details?: { error?: string } };

/** Envio pelo serviço de push da Expo, em lotes de 100 (limite da Expo). */
export const enviadorExpo: Enviador = async (lista) => {
  const saida: ResultadoDoEnvio[] = [];
  for (let i = 0; i < lista.length; i += 100) {
    const lote = lista.slice(i, i + 100);
    try {
      const r = await fetch(URL_DA_EXPO, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(
          lote.map((e) => ({
            to: e.para,
            title: e.titulo,
            body: e.corpo,
            data: e.dados,
            sound: "default",
            priority: "high",
          })),
        ),
      });
      const corpo = (await r.json().catch(() => null)) as { data?: TicketDaExpo[] } | null;
      if (!r.ok || !corpo?.data) {
        saida.push(...lote.map(() => ({ ok: false as const, erro: `expo ${r.status}` })));
        continue;
      }
      for (const t of corpo.data) {
        if (t.status === "ok") saida.push({ ok: true });
        else
          saida.push({
            ok: false,
            erro: t.message ?? "erro",
            tokenInvalido: t.details?.error === "DeviceNotRegistered",
          });
      }
    } catch (err) {
      saida.push(...lote.map(() => ({ ok: false as const, erro: err instanceof Error ? err.message : "rede" })));
    }
  }
  return saida;
};

/**
 * PD-50: na v0.1 a varredura roda dentro do processo da API, a cada minuto, município por município.
 * Devolve a função que para o intervalo.
 */
export function iniciarVarredura(
  slugs: () => Promise<string[]>,
  banco: (slug: string) => Promise<DbDoTenant | null>,
  log: (erro: unknown, slug: string) => void,
  enviar: Enviador = enviadorExpo,
  intervaloMs = 60_000,
): () => void {
  let rodando = false;
  const rodada = async () => {
    if (rodando) return;
    rodando = true;
    try {
      for (const slug of await slugs()) {
        const db = await banco(slug);
        if (db) await varrerMunicipio(db, Date.now(), enviar).catch((e) => log(e, slug));
      }
    } catch (e) {
      log(e, "*");
    } finally {
      rodando = false;
    }
  };
  const id = setInterval(rodada, intervaloMs);
  return () => clearInterval(id);
}
