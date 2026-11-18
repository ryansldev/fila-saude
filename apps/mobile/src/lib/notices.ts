import type { NoticeState } from "./push";

export type NoticeScreen = {
  title: string;
  text: string;
  /** O botão que liga os avisos; `null` quando já estão ligados. */
  button: string | null;
  /** A frase curta acima do botão (o que fazer na tela seguinte). */
  hint: string | null;
};

/** O que a tela dos avisos mostra em cada estado (na primeira vez e ao tocar no sininho). */
export function noticeScreen(state: NoticeState): NoticeScreen {
  if (state.kind === "on")
    return {
      title: "seus avisos estão ligados",
      text: "a gente te avisa a hora de sair de casa, mesmo com o app fechado. eles não mostram nada sobre a sua saúde.",
      button: null,
      hint: null,
    };
  if (state.kind === "off" && !state.canRequest)
    return {
      title: "seus avisos estão desligados",
      text: "sem eles, você pode perder a hora de sair de casa. ligue as notificações do fila saúde nos ajustes do celular.",
      button: "ligar nos ajustes",
      hint: null,
    };
  return {
    title: "a gente te avisa a hora de sair de casa",
    text: "os avisos chegam mesmo com o app fechado. eles não mostram nada sobre a sua saúde.",
    button: "ligar os avisos",
    hint: "na próxima tela, toque em “permitir”.",
  };
}
