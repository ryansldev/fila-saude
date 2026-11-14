import type { Ponto } from "@/lib/unidades";

/** Um pino por unidade com coordenadas; `aberto`: tem atendimento aberto para inscrição. */
export type PinoDoMapa = { id: string; nome: string; lat: number; lng: number; aberto: boolean };

export type PropsDoMapa = {
  pinos: PinoDoMapa[];
  /** Onde a pessoa está (só quando ela deixou usar a localização). */
  aqui: Ponto | null;
  selecionado: string | null;
  aoTocarPino: (id: string) => void;
  /** Toque fora dos pinos: tira a seleção. */
  aoTocarFora?: () => void;
  altura?: number;
};

export const ALTURA_DO_MAPA = 260;
