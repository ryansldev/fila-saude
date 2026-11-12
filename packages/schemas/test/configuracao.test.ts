import { describe, expect, it } from "vitest";
import { configMunicipioSchema } from "../config.ts";
import { estacaoEntradaSchema } from "../estacao.ts";
import { serieEntradaSchema } from "../serie.ts";
import { servicoEntradaSchema } from "../servico.ts";
import { sessaoEntradaSchema } from "../sessao.ts";
import { tvEstadoSchema } from "../tv.ts";
import { unidadeEntradaSchema } from "../unidade.ts";
import { usuarioPainelEntradaSchema } from "../usuario.ts";

const ok = (s: { safeParse: (v: unknown) => { success: boolean } }, v: unknown) => s.safeParse(v).success;
const id = "6f1c1f0e-8f0a-4b5e-9d0e-1c2b3a4d5e6f";

const unidade = {
  nome: "UBS Centro",
  tipo: "ubs",
  endereco: "Rua A, 1",
  lat: -23.5,
  lng: -46.6,
  fuso: "America/Sao_Paulo",
  horario: { "1": [{ abre: "08:00", fecha: "17:00" }] },
};

describe("unidadeEntradaSchema", () => {
  it("aceita unidade válida", () => expect(ok(unidadeEntradaSchema, unidade)).toBe(true));
  it("lat 90 / 90.0001", () => {
    expect(ok(unidadeEntradaSchema, { ...unidade, lat: 90 })).toBe(true);
    expect(ok(unidadeEntradaSchema, { ...unidade, lat: 90.0001 })).toBe(false);
    expect(ok(unidadeEntradaSchema, { ...unidade, lat: -90 })).toBe(true);
    expect(ok(unidadeEntradaSchema, { ...unidade, lat: -90.0001 })).toBe(false);
  });
  it("lng 180 / 180.0001", () => {
    expect(ok(unidadeEntradaSchema, { ...unidade, lng: 180 })).toBe(true);
    expect(ok(unidadeEntradaSchema, { ...unidade, lng: 180.0001 })).toBe(false);
    expect(ok(unidadeEntradaSchema, { ...unidade, lng: -180 })).toBe(true);
    expect(ok(unidadeEntradaSchema, { ...unidade, lng: -180.0001 })).toBe(false);
  });
  it("fuso IANA válido / inválido", () => {
    expect(ok(unidadeEntradaSchema, { ...unidade, fuso: "America/Sao_Paulo" })).toBe(true);
    expect(ok(unidadeEntradaSchema, { ...unidade, fuso: "Brasil/Recife" })).toBe(false);
  });
  it("config da unidade com toleranciaMin 0 recusada", () =>
    expect(ok(unidadeEntradaSchema, { ...unidade, config: { toleranciaMin: 0 } })).toBe(false));
  it("tipo inválido recusado", () => expect(ok(unidadeEntradaSchema, { ...unidade, tipo: "hospital" })).toBe(false));
  it("fecha antes de abre recusado; igual também", () => {
    const h = (abre: string, fecha: string) => ({ ...unidade, horario: { "1": [{ abre, fecha }] } });
    expect(ok(unidadeEntradaSchema, h("08:00", "07:59"))).toBe(false);
    expect(ok(unidadeEntradaSchema, h("08:00", "08:00"))).toBe(false);
    expect(ok(unidadeEntradaSchema, h("08:00", "08:01"))).toBe(true);
  });
  it("hora fora do formato HH:mm recusada", () => {
    expect(ok(unidadeEntradaSchema, { ...unidade, horario: { "1": [{ abre: "8:00", fecha: "17:00" }] } })).toBe(false);
    expect(ok(unidadeEntradaSchema, { ...unidade, horario: { "1": [{ abre: "08:00", fecha: "24:00" }] } })).toBe(false);
    expect(ok(unidadeEntradaSchema, { ...unidade, horario: { "1": [{ abre: "08:00", fecha: "23:59" }] } })).toBe(true);
  });
  it("dia da semana fora de 0..6 recusado", () =>
    expect(ok(unidadeEntradaSchema, { ...unidade, horario: { "7": [{ abre: "08:00", fecha: "17:00" }] } })).toBe(
      false,
    ));
  it("configurações opcionais aceitas", () =>
    expect(ok(unidadeEntradaSchema, { ...unidade, config: { janelaK: 2, toleranciaMin: null } })).toBe(true));
});

describe("configMunicipioSchema", () => {
  it("aceita vazio (tudo herda) e valores", () => {
    expect(ok(configMunicipioSchema, {})).toBe(true);
    expect(
      ok(configMunicipioSchema, {
        janelaK: 2,
        ordemMunicipio: "prioridade",
        alertaFaltas: { faltas: 2, dias: 90 },
      }),
    ).toBe(true);
  });
  it("janelaK 0 / 1", () => {
    expect(ok(configMunicipioSchema, { janelaK: 0 })).toBe(false);
    expect(ok(configMunicipioSchema, { janelaK: 1 })).toBe(true);
  });
  it("toleranciaMin 0/1 e inteiro", () => {
    expect(ok(configMunicipioSchema, { toleranciaMin: 0 })).toBe(false);
    expect(ok(configMunicipioSchema, { toleranciaMin: 1 })).toBe(true);
    expect(ok(configMunicipioSchema, { toleranciaMin: 1.5 })).toBe(false);
  });
  it("saiaDeCasaMin 0/1", () => {
    expect(ok(configMunicipioSchema, { saiaDeCasaMin: 0 })).toBe(false);
    expect(ok(configMunicipioSchema, { saiaDeCasaMin: 1 })).toBe(true);
  });
  it("qrSegundos 9/10 e 300/301", () => {
    expect(ok(configMunicipioSchema, { qrSegundos: 9 })).toBe(false);
    expect(ok(configMunicipioSchema, { qrSegundos: 10 })).toBe(true);
    expect(ok(configMunicipioSchema, { qrSegundos: 300 })).toBe(true);
    expect(ok(configMunicipioSchema, { qrSegundos: 301 })).toBe(false);
  });
  it("destaqueTvSegundos 2/3 e 60/61", () => {
    expect(ok(configMunicipioSchema, { destaqueTvSegundos: 2 })).toBe(false);
    expect(ok(configMunicipioSchema, { destaqueTvSegundos: 3 })).toBe(true);
    expect(ok(configMunicipioSchema, { destaqueTvSegundos: 60 })).toBe(true);
    expect(ok(configMunicipioSchema, { destaqueTvSegundos: 61 })).toBe(false);
  });
  it("prazoConfirmacaoHoras e tempoMedioInicialMin 0/1", () => {
    expect(ok(configMunicipioSchema, { prazoConfirmacaoHoras: 0 })).toBe(false);
    expect(ok(configMunicipioSchema, { prazoConfirmacaoHoras: 1 })).toBe(true);
    expect(ok(configMunicipioSchema, { tempoMedioInicialMin: 0 })).toBe(false);
    expect(ok(configMunicipioSchema, { tempoMedioInicialMin: 1 })).toBe(true);
  });
  it("alertaFaltas faltas/dias 0/1", () => {
    expect(ok(configMunicipioSchema, { alertaFaltas: { faltas: 0, dias: 90 } })).toBe(false);
    expect(ok(configMunicipioSchema, { alertaFaltas: { faltas: 1, dias: 0 } })).toBe(false);
    expect(ok(configMunicipioSchema, { alertaFaltas: { faltas: 1, dias: 1 } })).toBe(true);
  });
  it("booleanos de vínculo e pré-cadastro, anuláveis", () => {
    expect(ok(configMunicipioSchema, { exigePreCadastro: false, soVinculados: true, umaUnidadePorVez: null })).toBe(
      true,
    );
    expect(ok(configMunicipioSchema, { soVinculados: "sim" })).toBe(false);
    expect(ok(configMunicipioSchema, { umaUnidadePorVez: 1 })).toBe(false);
  });
  it("ordem inválida recusada", () => expect(ok(configMunicipioSchema, { ordemMunicipio: "x" })).toBe(false));
});

describe("usuarioPainelEntradaSchema", () => {
  const u = { login: "ana", nome: "Ana", senha: "12345678", perfis: [{ perfil: "admin", unidadeId: null }] };
  it("aceita válido", () => expect(ok(usuarioPainelEntradaSchema, u)).toBe(true));
  it("login 2/3", () => {
    expect(ok(usuarioPainelEntradaSchema, { ...u, login: "ab" })).toBe(false);
    expect(ok(usuarioPainelEntradaSchema, { ...u, login: "abc" })).toBe(true);
  });
  it("login 30/31", () => {
    expect(ok(usuarioPainelEntradaSchema, { ...u, login: "a".repeat(30) })).toBe(true);
    expect(ok(usuarioPainelEntradaSchema, { ...u, login: "a".repeat(31) })).toBe(false);
  });
  it("senha 7/8", () => {
    expect(ok(usuarioPainelEntradaSchema, { ...u, senha: "1234567" })).toBe(false);
    expect(ok(usuarioPainelEntradaSchema, { ...u, senha: "12345678" })).toBe(true);
  });
  it("perfil com unidadeId uuid; perfil inválido recusado", () => {
    expect(ok(usuarioPainelEntradaSchema, { ...u, perfis: [{ perfil: "recepcao", unidadeId: id }] })).toBe(true);
    expect(ok(usuarioPainelEntradaSchema, { ...u, perfis: [{ perfil: "paciente", unidadeId: null }] })).toBe(false);
    expect(ok(usuarioPainelEntradaSchema, { ...u, perfis: [{ perfil: "recepcao", unidadeId: "x" }] })).toBe(false);
  });
});

describe("servicoEntradaSchema", () => {
  const s = { nome: "Clínico", prefixo: "C", exigeTriagem: true, modo: "livre", tempoMedioMin: { atendimento: 15 } };
  it("aceita válido", () => expect(ok(servicoEntradaSchema, s)).toBe(true));
  it("prefixo 0/1 letras", () => {
    expect(ok(servicoEntradaSchema, { ...s, prefixo: "" })).toBe(false);
    expect(ok(servicoEntradaSchema, { ...s, prefixo: "C" })).toBe(true);
  });
  it("prefixo 3/4 letras", () => {
    expect(ok(servicoEntradaSchema, { ...s, prefixo: "CLI" })).toBe(true);
    expect(ok(servicoEntradaSchema, { ...s, prefixo: "CLIN" })).toBe(false);
  });
  it("prefixo só maiúsculas", () => {
    expect(ok(servicoEntradaSchema, { ...s, prefixo: "c" })).toBe(false);
    expect(ok(servicoEntradaSchema, { ...s, prefixo: "C1" })).toBe(false);
  });
  it("tempoMedioMin 0/1 por etapa", () => {
    expect(ok(servicoEntradaSchema, { ...s, tempoMedioMin: { triagem: 0 } })).toBe(false);
    expect(ok(servicoEntradaSchema, { ...s, tempoMedioMin: { triagem: 1 } })).toBe(true);
    expect(ok(servicoEntradaSchema, { ...s, tempoMedioMin: { atendimento: 0 } })).toBe(false);
  });
  it("modo inválido recusado", () => expect(ok(servicoEntradaSchema, { ...s, modo: "x" })).toBe(false));
});

describe("estacaoEntradaSchema", () => {
  const e = { nome: "Sala 1", etapa: "atendimento", servicos: [id] };
  it("aceita válido", () => expect(ok(estacaoEntradaSchema, e)).toBe(true));
  it("servicos 0/1", () => {
    expect(ok(estacaoEntradaSchema, { ...e, servicos: [] })).toBe(false);
    expect(ok(estacaoEntradaSchema, e)).toBe(true);
  });
  it("etapa inválida recusada", () => expect(ok(estacaoEntradaSchema, { ...e, etapa: "x" })).toBe(false));
});

describe("sessaoEntradaSchema", () => {
  const s = {
    servicoId: id,
    inicio: "2026-03-02T08:00:00.000Z",
    fim: "2026-03-02T12:00:00.000Z",
    vagas: 10,
    visibilidade: "publica",
    dispensaPreCadastro: false,
    profissional: null,
    estacoes: [],
  };
  it("aceita válida", () => expect(ok(sessaoEntradaSchema, s)).toBe(true));
  it("vagas -1/0/1 e null", () => {
    expect(ok(sessaoEntradaSchema, { ...s, vagas: -1 })).toBe(false);
    expect(ok(sessaoEntradaSchema, { ...s, vagas: 0 })).toBe(true);
    expect(ok(sessaoEntradaSchema, { ...s, vagas: 1 })).toBe(true);
    expect(ok(sessaoEntradaSchema, { ...s, vagas: null })).toBe(true);
  });
  it("fim antes ou igual ao início recusado", () => {
    expect(ok(sessaoEntradaSchema, { ...s, fim: s.inicio })).toBe(false);
    expect(ok(sessaoEntradaSchema, { ...s, fim: "2026-03-02T07:00:00.000Z" })).toBe(false);
  });
});

describe("serieEntradaSchema", () => {
  const s = {
    servicoId: id,
    dtstart: "2026-03-03T08:00",
    duracaoMin: 240,
    rrule: "FREQ=WEEKLY;BYDAY=TU",
    exdate: ["2026-03-10T08:00"],
    rdate: ["2026-03-12T08:00"],
    vagas: 10,
    visibilidade: "publica",
    dispensaPreCadastro: false,
    profissional: null,
    estacoes: [],
  };
  it("aceita válida", () => expect(ok(serieEntradaSchema, s)).toBe(true));
  it("duracaoMin 0/1", () => {
    expect(ok(serieEntradaSchema, { ...s, duracaoMin: 0 })).toBe(false);
    expect(ok(serieEntradaSchema, { ...s, duracaoMin: 1 })).toBe(true);
  });
  it("dtstart com fuso/segundos recusado", () => {
    expect(ok(serieEntradaSchema, { ...s, dtstart: "2026-03-03T08:00:00Z" })).toBe(false);
    expect(ok(serieEntradaSchema, { ...s, dtstart: "2026-03-03" })).toBe(false);
  });
  it("exdate/rdate são locais; omitidos viram vazio", () => {
    expect(ok(serieEntradaSchema, { ...s, exdate: ["x"] })).toBe(false);
    const { exdate: _e, rdate: _r, ...sem } = s;
    expect(serieEntradaSchema.parse(sem)).toMatchObject({ exdate: [], rdate: [] });
  });
  it("rrule vazia recusada", () => expect(ok(serieEntradaSchema, { ...s, rrule: "" })).toBe(false));
});

describe("tvEstadoSchema", () => {
  const exp = "2026-03-02T08:10:00.000Z";
  it("aguardando", () =>
    expect(ok(tvEstadoSchema, { estado: "aguardando", codigo: "123456", expiraEm: exp })).toBe(true));
  it("pareada", () => expect(ok(tvEstadoSchema, { estado: "pareada", unidade: { id, nome: "UBS" } })).toBe(true));
  it("pareada sem unidade e estado desconhecido recusados", () => {
    expect(ok(tvEstadoSchema, { estado: "pareada" })).toBe(false);
    expect(ok(tvEstadoSchema, { estado: "x" })).toBe(false);
  });
  it("código de 6 dígitos", () => {
    const v = (codigo: string) => ({ estado: "aguardando", codigo, expiraEm: exp });
    expect(ok(tvEstadoSchema, v("12345"))).toBe(false);
    expect(ok(tvEstadoSchema, v("1234567"))).toBe(false);
    expect(ok(tvEstadoSchema, v("12345a"))).toBe(false);
  });
});
