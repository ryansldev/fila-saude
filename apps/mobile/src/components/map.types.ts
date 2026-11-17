import type { Point } from "@/lib/units";

/** Um pino por unidade com coordenadas; `aberto`: tem atendimento aberto para inscrição. */
export type MapPin = { id: string; name: string; lat: number; lng: number; open: boolean };

export type MapProps = {
  pins: MapPin[];
  /** Onde a pessoa está (só quando ela deixou usar a localização). */
  here: Point | null;
  selected: string | null;
  onTapPin: (id: string) => void;
  /** Toque fora dos pinos: tira a seleção. */
  onTapOutside?: () => void;
  height?: number;
};

export const MAP_HEIGHT = 260;
