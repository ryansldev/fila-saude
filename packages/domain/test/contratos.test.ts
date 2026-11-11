import { describe, expect, it } from "vitest";
import {
  type EstadoEntrada,
  type EstadoItem,
  type EstadoSessao,
  TRANSICOES_ENTRADA,
  TRANSICOES_ITEM,
  TRANSICOES_SESSAO,
  transicaoUnica,
  transicionar,
} from "../src/contratos.ts";
import { lerTabelas, type Maquina, primeiraRegra } from "./specs-tabelas.ts";

const DADOS = {
  entrada: TRANSICOES_ENTRADA,
  item: TRANSICOES_ITEM,
  sessao: TRANSICOES_SESSAO,
} as const;

const tuplas = (linhas: { de: string; qualificador?: string | undefined; evento: string; para: string }[]) =>
  linhas.map((l) => [l.de, l.qualificador ?? "", l.evento, l.para].join(" | ")).sort();

const TABELAS = lerTabelas();

describe("contratos (AD-051)", () => {
  for (const maquina of ["entrada", "item", "sessao"] as Maquina[]) {
    it(`contratos AD-051: toda linha das specs está nos dados (${maquina})`, () => {
      const dasSpecs = TABELAS.filter((l) => l.maquina === maquina);
      expect(dasSpecs.length).toBeGreaterThan(0);
      expect(tuplas(DADOS[maquina])).toEqual(tuplas(dasSpecs));
    });

    it(`contratos AD-051: condição, efeitos e spec são os textos das specs (${maquina})`, () => {
      const dasSpecs = TABELAS.filter((l) => l.maquina === maquina);
      const completo = (l: {
        de: string;
        qualificador?: string | undefined;
        evento: string;
        para: string;
        paraQualificador?: string | undefined;
        condicao: string;
        efeitos: string;
        regra: string;
        spec: string;
      }) => [...tuplas([l]), l.paraQualificador ?? "", l.condicao, l.efeitos, l.regra, l.spec].join(" ## ");
      expect(DADOS[maquina].map(completo).sort()).toEqual(dasSpecs.map(completo).sort());
    });
  }

  it("contratos AD-051: transição não listada é proibida", () => {
    expect(transicionar(TRANSICOES_ENTRADA, "concluida", "Paciente cancela")).toBeNull();
    expect(transicionar(TRANSICOES_ENTRADA, "alocada", "Evento inexistente")).toBeNull();
    expect(transicionar(TRANSICOES_ENTRADA, "confirmada", "Sessão abre")).toBe("na_fila");
    expect(transicionar(TRANSICOES_ITEM, "chamado", "Rechamar")).toBe("(mesmo)");
    expect(transicionar(TRANSICOES_SESSAO, "planejada", "Cancela")).toBe("cancelada");
  });

  it("contratos AD-051: estados finais não têm saída, exceto a reversão da contingência", () => {
    const saidas = <S extends string>(t: { de: S | "—"; evento: string; para: string }[], finais: S[]) =>
      t.filter((x) => (finais as string[]).includes(x.de)).map((x) => `${x.de} | ${x.evento} | ${x.para}`);
    const finaisEntrada: EstadoEntrada[] = ["concluida", "cancelada", "encerrada_sem_atendimento"];
    const finaisItem: EstadoItem[] = ["saiu_da_fila", "remanejado"];
    const finaisSessao: EstadoSessao[] = ["cancelada", "encerrada"];
    expect(saidas(TRANSICOES_ENTRADA, finaisEntrada)).toHaveLength(1);
    const reversao = TRANSICOES_ENTRADA.find((x) => x.de === "encerrada_sem_atendimento");
    expect(reversao?.para).toBe("remanejada");
    expect(reversao?.spec).toBe("contingencia");
    expect(saidas(TRANSICOES_ITEM, finaisItem)).toEqual([]);
    expect(saidas(TRANSICOES_SESSAO, finaisSessao)).toEqual([]);
  });

  it("contratos AD-051: transição ambígua lança erro (chamado + Não compareceu)", () => {
    expect(() => transicionar(TRANSICOES_ITEM, "chamado", '"Não compareceu"')).toThrow(
      /transição ambígua.*chamado.*Não compareceu/,
    );
  });

  it("contratos AD-051: linhas com o mesmo (de, evento) e o mesmo destino devolvem esse destino", () => {
    const compartilhadas = [TRANSICOES_ENTRADA, TRANSICOES_ITEM, TRANSICOES_SESSAO].flatMap((tabela) =>
      (tabela as { de: string; evento: string; para: string }[]).filter(
        (a, i, todas) => todas.findIndex((b) => b.de === a.de && b.evento === a.evento) !== i,
      ),
    );
    // cada grupo repetido é ambíguo ou unânime; os unânimes não lançam
    const unanimes = TRANSICOES_ITEM.filter((a) =>
      TRANSICOES_ITEM.filter((b) => b.de === a.de && b.evento === a.evento).every((b) => b.para === a.para),
    ).filter((a) => TRANSICOES_ITEM.filter((b) => b.de === a.de && b.evento === a.evento).length > 1);
    expect(compartilhadas.length).toBeGreaterThan(0);
    expect(unanimes.length).toBeGreaterThan(0);
    for (const t of unanimes) {
      expect(transicionar(TRANSICOES_ITEM, t.de as EstadoItem, t.evento)).toBe(t.para);
    }
  });

  it("contratos AD-051: regra é o primeiro ID de regra em condição + efeitos, ou vazio", () => {
    for (const tabela of [TRANSICOES_ENTRADA, TRANSICOES_ITEM, TRANSICOES_SESSAO]) {
      for (const t of tabela)
        expect(t.regra, `${t.de} | ${t.evento}`).toBe(primeiraRegra(`${t.condicao} ${t.efeitos}`));
    }
  });

  it("contratos AD-051: transicaoUnica devolve a linha única, null sem linha e lança se ambígua", () => {
    expect(transicaoUnica(TRANSICOES_ENTRADA, "alocada", "Evento inexistente")).toBeNull();
    expect(transicaoUnica(TRANSICOES_ENTRADA, "arquivada", 'Serviço muda para "regulado"')?.para).toBe("cancelada");
    const livre = 'Serviço muda para "livre"';
    expect(() => transicaoUnica(TRANSICOES_ENTRADA, "aguardando_encaminhamento", livre)).toThrow(
      /contrato: mais de uma linha.*aguardando_encaminhamento/,
    );
    const comVaga = transicaoUnica(
      TRANSICOES_ENTRADA,
      "aguardando_encaminhamento",
      livre,
      (t) => t.qualificador === "vaga segura",
    );
    expect(comVaga?.para).toBe("confirmada");
    expect(
      transicaoUnica(TRANSICOES_ENTRADA, "aguardando_encaminhamento", livre, (t) => t.qualificador === "inexistente"),
    ).toBeNull();
  });
});
