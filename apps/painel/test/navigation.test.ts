import { can, PROFILES } from "@fila-saude/domain";
import { describe, expect, it } from "vitest";
import { MENU_ITEMS, panelMenu } from "@/lib/navigation";

const labels = (profiles: Parameters<typeof panelMenu>[0]) => panelMenu(profiles).map((i) => i.label);

describe("panelMenu", () => {
  it("menu da SMS tem unidades e equipe; do gerente da UBS, equipe, serviços, estações e sessões", () => {
    expect(labels([{ profile: "sms_management", unitId: null }])).toEqual(["Unidades", "Equipe"]);
    expect(labels([{ profile: "unit_manager", unitId: "u1" }])).toEqual([
      "Equipe",
      "Serviços",
      "Estações",
      "Sessões",
      "TVs",
      "Fila do dia",
      "QR de entrada",
    ]);
  });

  it("perfil acumulado soma os itens sem repetir", () => {
    const menu = panelMenu([
      { profile: "sms_management", unitId: null },
      { profile: "unit_manager", unitId: "u1" },
      { profile: "unit_manager", unitId: "u2" },
      { profile: "reception", unitId: "u1" },
      { profile: "nurse", unitId: "u1" },
    ]);
    expect(menu.map((i) => i.label)).toEqual([
      "Unidades",
      "Equipe",
      "Serviços",
      "Estações",
      "Sessões",
      "TVs",
      "Fila do dia",
      "QR de entrada",
      "Estação",
    ]);
    expect(new Set(menu.map((i) => i.href)).size).toBe(menu.length);
  });

  it("fatia 1: recepção vê a fila; quem atende vê a fila e a estação; sem item, 'Em breve'; sem perfis, vazio", () => {
    expect(labels([{ profile: "reception", unitId: "u1" }])).toEqual(["Fila do dia", "QR de entrada"]);
    expect(labels([{ profile: "care", unitId: "u1" }])).toEqual(["Fila do dia", "Estação"]);
    expect(labels([{ profile: "scheduler", unitId: "u1" }])).toEqual(["Agendamento"]);
    expect(labels([{ profile: "sms_regulation", unitId: null }])).toEqual(["Em breve"]);
    expect(labels([])).toEqual([]);
  });

  it("paciente não tem menu do painel", () => {
    expect(labels([{ profile: "patient", unitId: null }])).toEqual([]);
  });

  it("cada item aparece para um perfil exatamente quando a matriz permite a ação", () => {
    for (const profile of PROFILES) {
      const present = new Set(panelMenu([{ profile, unitId: null }]).map((i) => i.href));
      for (const item of MENU_ITEMS) {
        expect(present.has(item.href), `${profile} ${item.label}`).toBe(item.actions.some((a) => can([profile], a)));
      }
    }
  });
});
