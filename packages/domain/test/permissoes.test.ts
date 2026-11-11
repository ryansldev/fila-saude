import { describe, expect, it } from "vitest";
import { type Acao, MATRIZ, type Perfil, pode, textoDaCelula } from "../src/permissoes.ts";
import { podeDarPrioridade } from "../src/prioridade.ts";
import { lerMatriz, PERFIS_MATRIZ } from "./specs-tabelas.ts";

describe("permissoes (RN-PERF)", () => {
  it("permissoes: toda linha da matriz da spec está nos dados", () => {
    const daSpec = lerMatriz();
    expect(daSpec.length).toBeGreaterThan(0);
    expect(MATRIZ.map((l) => l.texto)).toEqual(daSpec.map((l) => l.texto));
    daSpec.forEach((linha, i) => {
      const dados = MATRIZ[i]?.perfis ?? {};
      PERFIS_MATRIZ.forEach((perfil, col) => {
        expect(textoDaCelula(dados[perfil]), `${linha.texto} / ${perfil}`).toBe(linha.celulas[col] ?? "");
      });
      expect(Object.keys(dados).every((p) => (PERFIS_MATRIZ as readonly string[]).includes(p))).toBe(true);
    });
    expect(new Set(MATRIZ.map((l) => l.acao)).size).toBe(MATRIZ.length);
  });

  it("permissoes: recepção não dá prioridade a quem já está na fila", () => {
    expect(pode(["recepcao"], "dar_prioridade")).toBe(true);
    expect(pode(["triagem"], "dar_prioridade")).toBe(false);
    expect(podeDarPrioridade("inclusao_balcao")).toBe(true);
    expect(podeDarPrioridade("primeira_presenca_sem_app")).toBe(true);
    expect(podeDarPrioridade("ja_na_fila")).toBe(false);
    // conferir ou tirar segue permitido a qualquer momento
    expect(pode(["recepcao"], "conferir_ou_tirar_prioridade")).toBe(true);
  });

  it("permissoes: perfil acumulado soma permissões", () => {
    const acoes = (perfis: Perfil[]) => MATRIZ.filter((l) => pode(perfis, l.acao)).map((l) => l.acao);
    const soma = new Set<Acao>([...acoes(["agendador"]), ...acoes(["triagem"])]);
    expect(new Set(acoes(["agendador", "triagem"]))).toEqual(soma);
    expect(pode(["agendador"], "operar_chamadas")).toBe(false);
    expect(pode(["agendador", "profissional"], "operar_chamadas")).toBe(true);
    expect(pode([], "alocar_confirmar_recusar_pelo_paciente")).toBe(false);
    expect(pode(["recepcao", "admin"], "imprimir_lista_do_dia")).toBe(true);
  });
});
