import { PERFIS, pode } from "@fila-saude/domain";
import { describe, expect, it } from "vitest";
import { ITENS_DO_MENU, menuDoPainel } from "@/lib/navegacao";

const rotulos = (perfis: Parameters<typeof menuDoPainel>[0]) => menuDoPainel(perfis).map((i) => i.rotulo);

describe("menuDoPainel", () => {
  it("menu da SMS tem unidades e equipe; do gerente da UBS, equipe, serviços, estações e sessões", () => {
    expect(rotulos([{ perfil: "gestao_sms", unidadeId: null }])).toEqual(["Unidades", "Equipe"]);
    expect(rotulos([{ perfil: "gerente_ubs", unidadeId: "u1" }])).toEqual([
      "Equipe",
      "Serviços",
      "Estações",
      "Sessões",
    ]);
  });

  it("perfil acumulado soma os itens sem repetir", () => {
    const menu = menuDoPainel([
      { perfil: "gestao_sms", unidadeId: null },
      { perfil: "gerente_ubs", unidadeId: "u1" },
      { perfil: "gerente_ubs", unidadeId: "u2" },
      { perfil: "recepcao", unidadeId: "u1" },
      { perfil: "enfermeiro", unidadeId: "u1" },
    ]);
    expect(menu.map((i) => i.rotulo)).toEqual(["Unidades", "Equipe", "Serviços", "Estações", "Sessões", "Em breve"]);
    expect(new Set(menu.map((i) => i.href)).size).toBe(menu.length);
  });

  it("demais perfis têm só o item em breve; sem perfis, menu vazio", () => {
    expect(rotulos([{ perfil: "atendimento", unidadeId: "u1" }])).toEqual(["Em breve"]);
    expect(rotulos([])).toEqual([]);
  });

  it("paciente não tem menu do painel", () => {
    expect(rotulos([{ perfil: "paciente", unidadeId: null }])).toEqual([]);
  });

  it("cada item aparece para um perfil exatamente quando a matriz permite a ação", () => {
    for (const perfil of PERFIS) {
      const presentes = new Set(menuDoPainel([{ perfil, unidadeId: null }]).map((i) => i.href));
      for (const item of ITENS_DO_MENU) {
        expect(presentes.has(item.href), `${perfil} ${item.rotulo}`).toBe(pode([perfil], item.acao));
      }
    }
  });
});
