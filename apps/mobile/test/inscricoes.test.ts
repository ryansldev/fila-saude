import type { MinhaEntrada } from "@fila-saude/schemas/fila";
import { describe, expect, it } from "vitest";
import {
  entradaAtiva,
  inscricaoNaAgenda,
  mesmaPessoa,
  outraPessoaJaInscrita,
  paraMimNoServico,
} from "@/lib/inscricoes";

const CURATIVOS = "00000000-0000-4000-8000-0000000000aa";
const CLINICO = "00000000-0000-4000-8000-0000000000bb";
const SESSAO_1 = "00000000-0000-4000-8000-000000000101";
const SESSAO_2 = "00000000-0000-4000-8000-000000000102";

const base: MinhaEntrada = {
  entradaId: "00000000-0000-4000-8000-000000000001",
  pessoa: "Ana Souza",
  estado: "confirmada",
  servico: "Curativos",
  unidade: "UBS Centro",
  sessao: { id: SESSAO_1, inicio: "2026-11-20T11:00:00Z", fim: "2026-11-20T15:00:00Z", estado: "planejada" },
  senha: null,
  itemEstado: null,
  estimativa: null,
  chamada: null,
  pendencias: [],
  saiaDeCasa: false,
  servicoId: CURATIVOS,
  paraMim: true,
  nascimento: "1990-05-05",
  podeCancelar: true,
};

describe("uma inscrição ativa por pessoa e serviço (AD-032), decidido antes de enviar", () => {
  it("entrada ativa: tudo que não terminou; as finais não contam", () => {
    for (const estado of ["confirmada", "na_fila", "na_reserva", "aguardando", "alocada"])
      expect(entradaAtiva({ ...base, estado })).toBe(true);
    for (const estado of ["cancelada", "concluida", "encerrada_sem_atendimento", "arquivada", "remanejada"])
      expect(entradaAtiva({ ...base, estado })).toBe(false);
  });

  it("agenda: dono da conta inscrito no serviço → 'inscrito', dizendo se é nesta data", () => {
    expect(inscricaoNaAgenda({ id: SESSAO_1, servico: { id: CURATIVOS } }, [base])).toEqual({
      tipo: "inscrito",
      nestaData: true,
    });
    // Outra data do mesmo serviço: também não pode (uma ativa por serviço).
    expect(inscricaoNaAgenda({ id: SESSAO_2, servico: { id: CURATIVOS } }, [base])).toEqual({
      tipo: "inscrito",
      nestaData: false,
    });
  });

  it("agenda: outro serviço, entrada encerrada ou só outra pessoa da conta → livre", () => {
    const s = { id: SESSAO_1, servico: { id: CURATIVOS } };
    expect(inscricaoNaAgenda({ id: SESSAO_1, servico: { id: CLINICO } }, [base])).toEqual({ tipo: "livre" });
    expect(inscricaoNaAgenda(s, [{ ...base, estado: "cancelada" }])).toEqual({ tipo: "livre" });
    expect(inscricaoNaAgenda(s, [{ ...base, paraMim: false, pessoa: "João" }])).toEqual({ tipo: "livre" });
    expect(inscricaoNaAgenda(s, [])).toEqual({ tipo: "livre" });
    // "minhas" ainda não chegou (ou falhou): não bloqueia; a API ainda recusa a duplicada.
    expect(inscricaoNaAgenda(s, null)).toEqual({ tipo: "livre" });
  });

  it("para quem é: 'para mim' bloqueado só quando o dono já tem entrada ativa no serviço", () => {
    expect(paraMimNoServico([base], CURATIVOS)).toBe(true);
    expect(paraMimNoServico([base], CLINICO)).toBe(false);
    expect(paraMimNoServico([{ ...base, estado: "concluida" }], CURATIVOS)).toBe(false);
    expect(paraMimNoServico([{ ...base, paraMim: false }], CURATIVOS)).toBe(false);
    expect(paraMimNoServico(null, CURATIVOS)).toBe(false);
    expect(paraMimNoServico([base], undefined)).toBe(false);
  });

  it("mesma pessoa: nome sem diferença de maiúsculas, acentos e espaços", () => {
    expect(mesmaPessoa("  João   da Silva ", "joao da silva")).toBe(true);
    expect(mesmaPessoa("João Silva", "João Souza")).toBe(false);
    expect(mesmaPessoa("", "")).toBe(false);
  });

  it("outra pessoa já inscrita no serviço pela conta: pelo nome, só entradas ativas que não são do dono", () => {
    const joao = { ...base, paraMim: false, pessoa: "João da Silva" };
    expect(outraPessoaJaInscrita([joao], CURATIVOS, "joão da  silva")).toBe(true);
    expect(outraPessoaJaInscrita([joao], CLINICO, "João da Silva")).toBe(false);
    expect(outraPessoaJaInscrita([{ ...joao, estado: "cancelada" }], CURATIVOS, "João da Silva")).toBe(false);
    // O dono não é "outra pessoa", mesmo com o mesmo nome digitado.
    expect(outraPessoaJaInscrita([base], CURATIVOS, "Ana Souza")).toBe(false);
    expect(outraPessoaJaInscrita(null, CURATIVOS, "João da Silva")).toBe(false);
  });
});
