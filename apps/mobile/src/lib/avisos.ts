import type { EstadoDosAvisos } from "./push";

export type TelaDosAvisos = {
  titulo: string;
  texto: string;
  /** O botão que liga os avisos; `null` quando já estão ligados. */
  botao: string | null;
  /** A frase curta acima do botão (o que fazer na tela seguinte). */
  dica: string | null;
};

/** O que a tela dos avisos mostra em cada estado (na primeira vez e ao tocar no sininho). */
export function telaDosAvisos(estado: EstadoDosAvisos): TelaDosAvisos {
  if (estado.tipo === "ligados")
    return {
      titulo: "seus avisos estão ligados",
      texto:
        "a gente te avisa a hora de sair de casa, mesmo com o app fechado. eles não mostram nada sobre a sua saúde.",
      botao: null,
      dica: null,
    };
  if (estado.tipo === "desligados" && !estado.podePedir)
    return {
      titulo: "seus avisos estão desligados",
      texto:
        "sem eles, você pode perder a hora de sair de casa. ligue as notificações do fila saúde nos ajustes do celular.",
      botao: "ligar nos ajustes",
      dica: null,
    };
  return {
    titulo: "a gente te avisa a hora de sair de casa",
    texto: "os avisos chegam mesmo com o app fechado. eles não mostram nada sobre a sua saúde.",
    botao: "ligar os avisos",
    dica: "na próxima tela, toque em “permitir”.",
  };
}
