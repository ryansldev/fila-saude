import type { DiaSessao, Entrada, Evento } from "@fila-saude/domain";
import { inArray } from "drizzle-orm";
import { aviso } from "infra/database/municipal/schema/aviso";
import { estacao } from "infra/database/municipal/schema/estacao";
import type { TxDoTenant } from "infra/database/tenants";

type Texto = { tipo: string; chave: string; titulo: string; corpo: string };
type Contexto = { unidade: string; senha: string; estacao: (id: string | undefined) => string };

const min = (s: string) => s.toLowerCase();

/**
 * T3.8 / RN-NOT-01: o que cada evento da fila diz ao paciente, só ação e local, nunca sintoma.
 * A chave identifica o evento: o mesmo evento nunca vira dois avisos.
 */
export function textoDoAviso(ev: Evento, ctx: Contexto): Texto | null {
  const d = ev.dados ?? {};
  const item = ev.itemId ?? "";
  switch (ev.tipo) {
    case "chamado":
      return {
        tipo: "sua_vez",
        chave: `sua_vez:${item}:${d.em}`,
        titulo: `é a sua vez! senha ${ctx.senha}`,
        corpo: `vá para ${min(ctx.estacao(ev.estacaoId))} na ${ctx.unidade}.`,
      };
    case "pulado": {
      const corpo =
        d.para === "saiu_da_fila"
          ? "você saiu da fila de hoje. se estiver na unidade, fale com a recepção."
          : d.para === "remoto"
            ? "você continua na fila. ao chegar na unidade, leia o QR de novo."
            : "você continua na fila, logo depois dos próximos. fique de olho na TV.";
      return {
        tipo: "pulado",
        chave: `pulado:${item}:${d.pulos}`,
        titulo: `chamamos a senha ${ctx.senha} e você não apareceu`,
        corpo,
      };
    }
    case "saia_de_casa":
      return {
        tipo: "saia_de_casa",
        chave: `saia_de_casa:${item}:${d.etapa}`,
        titulo: "hora de sair de casa",
        corpo: `faltam cerca de ${d.minutos} min para a sua vez na ${ctx.unidade}. ao chegar, leia o QR da TV.`,
      };
    case "venha_agora":
      return {
        tipo: "venha_agora",
        chave: `venha_agora:${item}:${d.etapa}:${d.em}`, // "Vou sair" recomeça (AD-057)
        titulo: "venha agora",
        corpo: `você é o próximo na ${ctx.unidade}. ao chegar, leia o QR da TV.`,
      };
    default:
      return null;
  }
}

/** Onde e quando é a sessão do evento, para os avisos que não têm item na fila (o "confirme"). */
export type LocalDoAviso = { unidade: string; servico: string; inicio: Date; fuso: string };

const quando = (inicio: Date, fuso: string) => {
  const f = new Intl.DateTimeFormat("pt-BR", {
    timeZone: fuso,
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(inicio);
  const p = (t: string) => f.find((x) => x.type === t)?.value ?? "";
  return `${p("weekday")}, ${p("day")}/${p("month")} às ${p("hour")}:${p("minute")}`;
};

/** RN-CONF-01 / I8: o "confirme" da alocação; uma chave por alocação (o prazo muda a cada uma). */
export function textoDaAlocacao(ev: Evento, local: LocalDoAviso): Texto | null {
  if (ev.tipo !== "alocada") return null;
  return {
    tipo: "confirme",
    chave: `confirme:${ev.entradaId}:${ev.sessaoId}:${ev.dados?.prazo}`,
    titulo: "confirme sua consulta",
    corpo: `${local.servico} na ${local.unidade}, ${quando(local.inicio, local.fuso)}. abra o app para confirmar.`,
  };
}

// PD-49: grava os avisos dos eventos na transação da fila; quem não tem conta (balcão) não recebe push.
export async function gravarAvisos(
  tx: TxDoTenant,
  local: LocalDoAviso,
  dia: DiaSessao | null,
  entradas: Entrada[],
  eventos: Evento[],
): Promise<void> {
  if (eventos.length === 0) return;
  const ids = [...new Set(eventos.map((e) => e.estacaoId).filter((x): x is string => Boolean(x)))];
  const nomes = new Map(
    ids.length === 0
      ? []
      : (await tx.select({ id: estacao.id, nome: estacao.nome }).from(estacao).where(inArray(estacao.id, ids))).map(
          (e) => [e.id, e.nome],
        ),
  );
  const linhas: (typeof aviso.$inferInsert)[] = [];
  for (const ev of eventos) {
    const entrada = entradas.find((e) => e.id === ev.entradaId);
    if (!entrada?.responsavelId) continue;
    const alocacao = textoDaAlocacao(ev, local);
    if (alocacao) {
      linhas.push({ ...alocacao, pacienteId: entrada.responsavelId, entradaId: entrada.id });
      continue;
    }
    const item = dia?.itens.find((i) => i.id === ev.itemId);
    if (!item) continue;
    const t = textoDoAviso(ev, {
      unidade: local.unidade,
      senha: item.senha,
      estacao: (id) => nomes.get(id ?? "") ?? "",
    });
    if (t) linhas.push({ ...t, pacienteId: entrada.responsavelId, entradaId: entrada.id });
  }
  if (linhas.length > 0) await tx.insert(aviso).values(linhas).onConflictDoNothing({ target: aviso.chave });
}
