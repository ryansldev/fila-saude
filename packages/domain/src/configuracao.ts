import { CONFIG_PADRAO } from "./fila.ts";
import type { ConfigUnidade } from "./tipos.ts";

/** Configuração em um nível da herança: ausente ou nulo = herda (PD-28). */
export type ConfigParcial = Partial<ConfigUnidade> & {
  exigePreCadastro?: boolean;
  soVinculados?: boolean;
  umaUnidadePorVez?: boolean;
};

export type OrigemConfig = "padrao" | "municipio" | "unidade";

export type ConfigEfetiva = ConfigUnidade & {
  exigePreCadastro: boolean;
  soVinculados: boolean;
  umaUnidadePorVez: boolean;
  origem: Record<string, OrigemConfig>;
};

type Base = ConfigUnidade & {
  exigePreCadastro: boolean;
  soVinculados: boolean;
  umaUnidadePorVez: boolean;
};

/** Padrões finais: CONFIG_PADRAO + pré-cadastro ligado (AD-053), vínculo e uma unidade por vez desligados. */
const PADRAO: Base = {
  ...CONFIG_PADRAO,
  exigePreCadastro: true,
  soVinculados: false,
  umaUnidadePorVez: false,
};

/** unidade → município → padrão; nulo ou ausente herda. */
export function configEfetiva(niveis: { municipio: ConfigParcial; unidade: ConfigParcial }): ConfigEfetiva {
  const valor: Record<string, unknown> = {};
  const origem: Record<string, OrigemConfig> = {};
  for (const campo of Object.keys(PADRAO)) {
    const cadeia: [OrigemConfig, Record<string, unknown>][] = [
      ["unidade", niveis.unidade],
      ["municipio", niveis.municipio],
    ];
    let achado = false;
    for (const [nome, nivel] of cadeia) {
      const v = nivel[campo];
      if (v !== undefined && v !== null) {
        valor[campo] = v;
        origem[campo] = nome;
        achado = true;
        break;
      }
    }
    if (!achado) {
      valor[campo] = (PADRAO as Record<string, unknown>)[campo];
      origem[campo] = "padrao";
    }
  }
  return { ...(valor as Base), origem };
}

export type ResultadoValidacao = { ok: true } | { ok: false; campos: Record<string, string> };

const fusoValido = (fuso: string): boolean => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: fuso });
    return true;
  } catch {
    return false;
  }
};

const inteiroEntre = (v: number, min: number, max = Number.POSITIVE_INFINITY) =>
  Number.isInteger(v) && v >= min && v <= max;

/** Valida os campos presentes; ausente/nulo não é validado (herda). */
export function validarConfig(c: ConfigParcial): ResultadoValidacao {
  const campos: Record<string, string> = {};
  const checa = (campo: keyof ConfigUnidade, ok: (v: never) => boolean, msg: string): void => {
    const v = c[campo];
    if (v !== undefined && v !== null && !ok(v as never)) campos[campo] = msg;
  };
  checa("janelaK", (v: number) => inteiroEntre(v, 1), "K deve ser inteiro ≥ 1");
  checa("toleranciaMin", (v: number) => inteiroEntre(v, 1), "tolerância deve ser ≥ 1 min");
  checa("saiaDeCasaMin", (v: number) => inteiroEntre(v, 1), '"saia de casa" deve ser ≥ 1 min');
  checa("qrSegundos", (v: number) => inteiroEntre(v, 10, 300), "QR deve ficar entre 10 e 300 s");
  checa("destaqueTvSegundos", (v: number) => inteiroEntre(v, 3, 60), "destaque da TV deve ficar entre 3 e 60 s");
  checa("prazoConfirmacaoHoras", (v: number) => inteiroEntre(v, 1), "prazo de confirmação deve ser ≥ 1 h");
  checa(
    "alertaFaltas",
    (v: { faltas: number; dias: number }) => inteiroEntre(v.faltas, 1) && inteiroEntre(v.dias, 1),
    "faltas e dias devem ser ≥ 1",
  );
  checa("fuso", (v: string) => fusoValido(v), "fuso IANA inválido");
  // Com 0, toda estimativa dá 0 min e todo remoto recebe "saia de casa" na abertura.
  checa("tempoMedioInicialMin", (v: number) => inteiroEntre(v, 1, 480), "tempo médio inicial entre 1 e 480 min");
  checa("ordemMunicipio", (v: string) => v === "risco" || v === "prioridade", "ordem deve ser risco ou prioridade");
  return Object.keys(campos).length === 0 ? { ok: true } : { ok: false, campos };
}
