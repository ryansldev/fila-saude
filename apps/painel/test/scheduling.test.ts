import { describe, expect, it } from "vitest";
import { MENU_ICONS, MENU_ITEMS, panelMenu } from "@/lib/navigation";
import {
  allocatedSituation,
  allocateUntil,
  pendingChecksSummary,
  reasonRow,
  riskBadge,
  riskLabel,
  slotBars,
  slotText,
  whenInTimeZone,
} from "@/lib/scheduling";

const TIME_ZONE = "America/Sao_Paulo";

describe("agendamento no painel (fatia 4)", () => {
  it("menu: quem agenda vê 'Agendamento' (e não mais 'Em breve')", () => {
    expect(panelMenu([{ profile: "scheduler", unitId: "u1" }]).map((i) => i.label)).toEqual(["Agendamento"]);
  });

  it("data e hora no fuso da unidade, com o dia da semana", () => {
    // 2026-11-18 11:00Z = 08:00 em São Paulo (quarta-feira).
    expect(whenInTimeZone("2026-11-18T11:00:00.000Z", TIME_ZONE)).toBe("qua., 18/11 às 08:00");
  });

  it("vagas: ocupadas de quantas; sem limite diz 'sem limite'", () => {
    expect(slotText(2, 5)).toBe("2 de 5 vagas");
    expect(slotText(3, null)).toBe("3 alocados · sem limite");
  });

  it("RN-CONF-03: situação do alocado; sem resposta depois do prazo fica destacada", () => {
    expect(allocatedSituation({ state: "allocated", highlighted: false })).toEqual({
      label: "Aguardando resposta",
      tone: "neutral",
    });
    expect(allocatedSituation({ state: "allocated", highlighted: true })).toEqual({
      label: "Sem resposta: ligar",
      tone: "alert",
    });
    expect(allocatedSituation({ state: "confirmed", highlighted: false })).toEqual({ label: "Confirmou", tone: "ok" });
    expect(allocatedSituation({ state: "in_queue", highlighted: false }).label).toBe("Na fila");
  });

  it("RN-RISCO-01: o risco diz se é sugerido pelo app ou confirmado pela triagem", () => {
    expect(riskLabel({ level: "urgent", confirmed: false })).toBe("Urgente · sugerido pelo app");
    expect(riskLabel({ level: "attention", confirmed: true })).toBe("Atenção · confirmado");
  });

  it("todo item do menu tem ícone (Agendamento tinha um círculo vazio)", () => {
    for (const item of MENU_ITEMS) expect(MENU_ICONS[item.href], item.label).toBeDefined();
  });

  it("barrinhas de vagas: confirmadas, pendentes, livres; sem limite não desenha", () => {
    expect(slotBars({ slots: 4, confirmed: 1, pending: 1 })).toEqual(["confirmed", "pending", "free", "free"]);
    expect(slotBars({ slots: null, confirmed: 2, pending: 0 })).toBeNull();
  });

  it("selo do risco: '(app)' quando sugerido; confirmado sem o '(app)'", () => {
    expect(riskBadge({ level: "urgent", confirmed: false })).toEqual({ label: "Urgente (app)", tone: "alert" });
    expect(riskBadge({ level: "routine", confirmed: true })).toEqual({ label: "Rotina", tone: "neutral" });
    expect(riskBadge({ level: "emergency", confirmed: true })?.tone).toBe("danger");
  });

  it("pendências: nada para ligar some; senão, quantas e quem espera há mais tempo", () => {
    expect(pendingChecksSummary([], 0)).toBeNull();
    const now = Date.parse("2026-11-16T12:00:00.000Z");
    const item = (name: string, hours: number) => ({
      entryId: "00000000-0000-4000-8000-000000000001",
      name,
      phone: null,
      service: "Odontologia",
      session: { id: "00000000-0000-4000-8000-000000000002", start: "2026-11-19T16:00:00.000Z" },
      allocatedAt: new Date(now - hours * 3600_000).toISOString(),
      deadline: new Date(now - hours * 3600_000 + 24 * 3600_000).toISOString(),
      highlighted: hours >= 24,
      lastAttempt: null,
    });
    expect(pendingChecksSummary([item("Ana Souza", 2), item("Bruno Lima", 30)], now)).toEqual({
      total: 2,
      text: "2 pessoas para ligar · Bruno Lima sem resposta há 30 h",
    });
    expect(pendingChecksSummary([item("Ana Souza", 2)], now)?.text).toBe(
      "1 pessoa para ligar · Ana Souza sem resposta há 2 h",
    );
  });

  it("alocação vai até a véspera, no fuso da unidade", () => {
    expect(allocateUntil("2026-11-17T16:00:00.000Z", TIME_ZONE)).toBe("seg., 16/11");
  });

  it("rotina sugerida não leva selo (só o risco que muda a ordem chama atenção)", () => {
    expect(riskBadge({ level: "routine", confirmed: false })).toBeNull();
    expect(riskBadge({ level: "attention", confirmed: false })?.label).toBe("Atenção (app)");
  });

  it("a linha de motivos não repete 'sem sinais de risco' de quem é rotina", () => {
    const reasons = ["pessoa idosa, 68 anos", "espera há 3 dias"];
    expect(reasonRow({ level: "routine", rule: "Sem sinais de risco" }, reasons)).toBe(
      "pessoa idosa, 68 anos · espera há 3 dias",
    );
    expect(reasonRow({ level: "urgent", rule: "Problema novo forte" }, ["espera há 3 dias"])).toBe(
      "Problema novo forte · espera há 3 dias",
    );
  });
});
