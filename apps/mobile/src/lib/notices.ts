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

/**
 * Logo depois de entrar, explica os avisos antes do pedido do celular, uma vez só. No Android 13+ quem
 * nunca foi perguntado chega como negado que ainda pode pedir (o celular não distingue), então conta também.
 * No Android 12 ou mais antigo, negado é desligado nos ajustes (o pedido não mostra nada); no iPhone
 * (`androidApi` nulo), negado já foi perguntado.
 */
export function explainNoticesFirst(state: NoticeState, explained: boolean, androidApi: number | null): boolean {
  if (explained) return false;
  if (state.kind === "ask") return true;
  return state.kind === "off" && state.canRequest && androidApi !== null && androidApi >= 33;
}
