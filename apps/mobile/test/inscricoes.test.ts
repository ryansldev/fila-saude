import type { MinhaEntrada } from "@fila-saude/schemas/fila";
import { describe, expect, it } from "vitest";
import { ErroDaApi } from "@/lib/api";
import {
  entradaAtiva,
  erroDaVerificacao,
  inscricaoNaAgenda,
  mesmaPessoa,
  mesmoNome,
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
    // Remanejada continua ativa: a pessoa segue no serviço esperando a nova data.
    for (const estado of ["confirmada", "na_fila", "na_reserva", "aguardando", "alocada", "remanejada"])
      expect(entradaAtiva({ ...base, estado })).toBe(true);
    for (const estado of ["cancelada", "concluida", "encerrada_sem_atendimento", "arquivada"])
      expect(entradaAtiva({ ...base, estado })).toBe(false);
  });

  it("agenda: o selo diz como o dono está no serviço; o cartão ainda inscreve outra pessoa", () => {
    const s1 = { id: SESSAO_1, servico: { id: CURATIVOS } };
    const s2 = { id: SESSAO_2, servico: { id: CURATIVOS } };
    expect(inscricaoNaAgenda(s1, [base])).toEqual({
      tipo: "inscrito",
      selo: "inscrito",
      podeOutra: true,
    });
    expect(inscricaoNaAgenda(s2, [base])).toMatchObject({ selo: "já tem data" });
    expect(inscricaoNaAgenda(s2, [{ ...base, estado: "aguardando", sessao: null }])).toMatchObject({
      selo: "lista de espera",
    });
    expect(inscricaoNaAgenda(s1, [{ ...base, estado: "na_reserva" }])).toMatchObject({
      selo: "na reserva",
    });
    expect(inscricaoNaAgenda(s2, [{ ...base, estado: "remanejada" }])).toMatchObject({
      selo: "nova data",
    });
  });

  it("agenda: com o limite de pessoas da conta nesta data, não há o que fazer além de ver minha fila", () => {
    const s1 = { id: SESSAO_1, servico: { id: CURATIVOS } };
    const outras = [1, 2, 3, 4].map((i) => ({ ...base, entradaId: `e${i}`, paraMim: false, pessoa: `P${i}` }));
    expect(inscricaoNaAgenda(s1, [base, ...outras])).toMatchObject({ tipo: "inscrito", podeOutra: false });
    expect(inscricaoNaAgenda(s1, [base, ...outras.slice(1)])).toMatchObject({ podeOutra: true });
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

  it("mesmo nome: sem diferença de maiúsculas, acentos e espaços", () => {
    expect(mesmoNome("  João   da Silva ", "joao da silva")).toBe(true);
    expect(mesmoNome("João Silva", "João Souza")).toBe(false);
    expect(mesmoNome("", "")).toBe(false);
  });

  it("mesma pessoa (RN-LE-02): CPF quando os dois têm; senão nome e nascimento", () => {
    const joao = { nome: "João da Silva", nascimento: "2010-01-02", cpf: "529.982.247-25" };
    expect(mesmaPessoa(joao, { ...joao, nome: "Outro Nome", cpf: "52998224725" })).toBe(true);
    expect(mesmaPessoa(joao, { ...joao, cpf: "111.444.777-35" })).toBe(false);
    expect(mesmaPessoa(joao, { nome: "joao da silva", nascimento: "2010-01-02", cpf: null })).toBe(true);
    expect(mesmaPessoa(joao, { nome: "joao da silva", nascimento: "2010-01-03" })).toBe(false);
    expect(mesmaPessoa(joao, { nome: "joao da silva", nascimento: "" })).toBe(false);
  });

  it("outra pessoa já inscrita no serviço pela conta: nome + nascimento, só entradas ativas que não são do dono", () => {
    const joao = { ...base, paraMim: false, pessoa: "João da Silva", nascimento: "2010-01-02" };
    const digitado = { nome: "joão da  silva", nascimento: "2010-01-02", cpf: "" };
    expect(outraPessoaJaInscrita([joao], CURATIVOS, digitado)).toBe(true);
    // Homônimo com outra data de nascimento é outra pessoa.
    expect(outraPessoaJaInscrita([joao], CURATIVOS, { ...digitado, nascimento: "2011-01-02" })).toBe(false);
    // Data ainda incompleta (dataIso vazio): não acusa nada antes da hora.
    expect(outraPessoaJaInscrita([joao], CURATIVOS, { ...digitado, nascimento: "" })).toBe(false);
    expect(outraPessoaJaInscrita([joao], CLINICO, digitado)).toBe(false);
    expect(outraPessoaJaInscrita([{ ...joao, estado: "cancelada" }], CURATIVOS, digitado)).toBe(false);
    expect(outraPessoaJaInscrita([{ ...joao, estado: "remanejada" }], CURATIVOS, digitado)).toBe(true);
    // O dono não é "outra pessoa", mesmo com o mesmo nome digitado.
    expect(outraPessoaJaInscrita([base], CURATIVOS, { nome: "Ana Souza", nascimento: "1990-05-05" })).toBe(false);
    expect(outraPessoaJaInscrita(null, CURATIVOS, digitado)).toBe(false);
  });
});

describe("conferência antes do questionário (/verificar): onde o erro aparece no passo 'para quem'", () => {
  const erro = (codigo: string, mensagem?: string) => new ErroDaApi(409, codigo, mensagem);

  it("CPF da conta, pessoa com conta e CPF inválido: embaixo do CPF", () => {
    expect(erroDaVerificacao(erro("cpf_da_conta", "Esse é o seu CPF."))).toEqual({
      tipo: "campo",
      campo: "cpf",
      texto: 'esse é o seu CPF. para você, escolha "para mim".',
    });
    expect(erroDaVerificacao(erro("pessoa_tem_conta"))).toMatchObject({ tipo: "campo", campo: "cpf" });
    expect(erroDaVerificacao(new ErroDaApi(400, "cpf_invalido"))).toMatchObject({ tipo: "campo", campo: "cpf" });
  });

  it("dados que não batem com o CPF: embaixo do nome e da data", () => {
    expect(erroDaVerificacao(erro("pessoa_divergente"))).toMatchObject({ tipo: "pessoa" });
  });

  it("sessão fechada ou privada: faixa com saída para os atendimentos; limite, requisição e duplicada: minha fila", () => {
    expect(erroDaVerificacao(erro("sessao_fechada"))).toMatchObject({ tipo: "faixa", saida: "agenda" });
    expect(erroDaVerificacao(erro("sessao_privada"))).toMatchObject({ tipo: "faixa", saida: "agenda" });
    const limite = erroDaVerificacao(erro("limite_por_conta", "Uma conta inscreve até 5 pessoas."));
    expect(limite).toMatchObject({ tipo: "faixa", saida: "fila", texto: "Uma conta inscreve até 5 pessoas." });
    expect(erroDaVerificacao(erro("requisicao_pendente"))).toMatchObject({ tipo: "faixa", saida: "fila" });
    expect(erroDaVerificacao(erro("duplicada"))).toMatchObject({ tipo: "faixa", saida: "fila" });
  });

  it("sem internet ou outro erro: faixa sem saída (tentar de novo)", () => {
    expect(erroDaVerificacao(new ErroDaApi(0, "sem_conexao"))).toMatchObject({ tipo: "faixa", saida: null });
  });
});
