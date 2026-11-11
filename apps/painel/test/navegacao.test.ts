import { type Perfil, pode } from "@fila-saude/domain";
import { describe, expect, it } from "vitest";
import { ITENS_DO_MENU, menuDoPainel } from "@/lib/navegacao";

const rotulos = (perfis: Parameters<typeof menuDoPainel>[0]) => menuDoPainel(perfis).map((i) => i.rotulo);

describe("menuDoPainel", () => {
  it("menu do gestor tem unidades, usuários e regras; do admin, serviços, estações, sessões e TVs", () => {
    expect(rotulos([{ perfil: "gestor", unidadeId: null }])).toEqual(["Unidades", "Usuários", "Regras do município"]);
    expect(rotulos([{ perfil: "admin", unidadeId: "u1" }])).toEqual(["Serviços", "Estações", "Sessões", "TVs"]);
  });

  it("perfil acumulado soma os itens sem repetir", () => {
    const menu = menuDoPainel([
      { perfil: "gestor", unidadeId: null },
      { perfil: "admin", unidadeId: "u1" },
      { perfil: "admin", unidadeId: "u2" },
      { perfil: "recepcao", unidadeId: "u1" },
      { perfil: "triagem", unidadeId: "u1" },
    ]);
    expect(menu.map((i) => i.rotulo)).toEqual([
      "Unidades",
      "Usuários",
      "Regras do município",
      "Serviços",
      "Estações",
      "Sessões",
      "TVs",
      "Em breve",
    ]);
    expect(new Set(menu.map((i) => i.href)).size).toBe(menu.length);
  });

  it("demais perfis têm só o item em breve; sem perfis, menu vazio", () => {
    expect(rotulos([{ perfil: "profissional", unidadeId: "u1" }])).toEqual(["Em breve"]);
    expect(rotulos([])).toEqual([]);
  });

  it("paciente não tem menu do painel", () => {
    expect(rotulos([{ perfil: "paciente", unidadeId: null }])).toEqual([]);
  });

  it("cada item aparece para um perfil exatamente quando a matriz permite a ação", () => {
    const perfis: Perfil[] = ["paciente", "gestor", "admin", "agendador", "recepcao", "triagem", "profissional"];
    for (const perfil of perfis) {
      const presentes = new Set(menuDoPainel([{ perfil, unidadeId: null }]).map((i) => i.href));
      for (const item of ITENS_DO_MENU) {
        expect(presentes.has(item.href), `${perfil} ${item.rotulo}`).toBe(pode([perfil], item.acao));
      }
    }
  });
});
