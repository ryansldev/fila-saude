import type { PublicUnit } from "@fila-saude/schemas/queue";
import { describe, expect, it } from "vitest";
import {
  appointmentsText,
  directionsLink,
  distanceKm,
  distanceText,
  kindName,
  postalCode,
  sortUnits,
  walkingMinutes,
} from "@/lib/units";

const IF = { lat: -23.5505, lng: -46.6333 };

const unit = (name: string, lat: number | null, lng: number | null, extra: Partial<PublicUnit> = {}) =>
  ({
    id: `00000000-0000-4000-8000-${name.length.toString().padStart(12, "0")}`,
    name,
    kind: "ubs",
    address: { street: "Rua das Flores", number: "100", neighborhood: "Centro", postalCode: "01001000" },
    lat,
    lng,
    appointments: 0,
    timeZone: "America/Sao_Paulo",
    ...extra,
  }) satisfies PublicUnit;

describe("distanciaKm (haversine)", () => {
  it("é zero no mesmo ponto", () => {
    expect(distanceKm(IF, IF)).toBe(0);
  });

  it("da Sé à Paulista dá uns 2,6 km em linha reta", () => {
    expect(distanceKm(IF, { lat: -23.5613, lng: -46.6565 })).toBeCloseTo(2.66, 1);
  });

  it("um grau de latitude dá uns 111 km", () => {
    expect(distanceKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111.19, 1);
  });

  it("é simétrica", () => {
    const a = { lat: -23.5531, lng: -46.6528 };
    expect(distanceKm(IF, a)).toBeCloseTo(distanceKm(a, IF), 9);
  });
});

describe("minutosAPe (5 km/h)", () => {
  it("1 km dá 12 minutos", () => {
    expect(walkingMinutes(1)).toBe(12);
  });

  it("arredonda para o minuto mais perto", () => {
    expect(walkingMinutes(1.2)).toBe(14);
    expect(walkingMinutes(2.66)).toBe(32);
  });

  it("nunca diz 0 minutos", () => {
    expect(walkingMinutes(0)).toBe(1);
    expect(walkingMinutes(0.02)).toBe(1);
  });
});

describe("distanceText", () => {
  it("km com vírgula e uma casa, e os minutos a pé", () => {
    expect(distanceText(1.23)).toBe("1,2 km · 15 min a pé");
  });

  it("perto de 1 km ou menos, em metros redondos", () => {
    expect(distanceText(0.34)).toBe("350 m · 4 min a pé");
    expect(distanceText(0.01)).toBe("50 m · 1 min a pé");
  });

  it("longe, sem casa decimal e em horas", () => {
    expect(distanceText(12.4)).toBe("12 km · 2 h 29 min a pé");
  });
});

describe("sortUnits", () => {
  const center = unit("UBS Centro", -23.5505, -46.6333);
  const south = unit("Policlínica Sul", -23.5613, -46.6565);
  const vila = unit("UBS Vila Nova", -23.5531, -46.6528);
  const withoutMap = unit("Ambulatório Sem Mapa", null, null);

  it("com a localização, da mais perto para a mais longe, como no Uber", () => {
    const r = sortUnits([south, vila, center], IF);
    expect(r.map((x) => x.unit.name)).toEqual(["UBS Centro", "UBS Vila Nova", "Policlínica Sul"]);
    expect(r[0]?.km).toBe(0);
    expect(r[2]?.km).toBeCloseTo(2.66, 1);
  });

  it("unidade sem coordenadas vai para o fim, sem distância", () => {
    const r = sortUnits([withoutMap, south, center], IF);
    expect(r.map((x) => x.unit.name)).toEqual(["UBS Centro", "Policlínica Sul", "Ambulatório Sem Mapa"]);
    expect(r[2]?.km).toBeNull();
  });

  it("sem a localização, em ordem alfabética (acentos e maiúsculas não atrapalham)", () => {
    const r = sortUnits([vila, center, unit("úbs ágata", 1, 1), south, withoutMap], null);
    expect(r.map((x) => x.unit.name)).toEqual([
      "Ambulatório Sem Mapa",
      "Policlínica Sul",
      "úbs ágata",
      "UBS Centro",
      "UBS Vila Nova",
    ]);
    expect(r.every((x) => x.km === null)).toBe(true);
  });

  it("não mexe na lista recebida", () => {
    const list = [south, center];
    sortUnits(list, IF);
    expect(list).toEqual([south, center]);
  });
});

describe("textos da unidade", () => {
  it("nome do tipo em linguagem simples", () => {
    expect(kindName("ubs")).toBe("posto de saúde (UBS)");
    expect(kindName("polyclinic")).toBe("policlínica");
    expect(kindName("upa")).toBe("pronto atendimento (UPA)");
    expect(kindName("outro")).toBe("unidade de saúde");
  });

  it("quantos atendimentos abertos", () => {
    expect(appointmentsText(0)).toBe("sem vaga agora");
    expect(appointmentsText(1)).toBe("1 aberto");
    expect(appointmentsText(3)).toBe("3 abertos");
  });

  it("CEP formatado (com ou sem máscara na origem)", () => {
    expect(postalCode("01001000")).toBe("01001-000");
    expect(postalCode("01001-000")).toBe("01001-000");
    expect(postalCode("0100")).toBe("0100");
  });
});

describe("directionsLink", () => {
  const u = unit("UBS Centro", -23.5505, -46.6333);

  it("no Android abre o app de mapas pelo geo:", () => {
    expect(directionsLink(u, "android")).toBe("geo:-23.5505,-46.6333?q=-23.5505,-46.6333(UBS%20Centro)");
  });

  it("no iPhone abre o Apple Maps com a rota", () => {
    expect(directionsLink(u, "ios")).toBe("https://maps.apple.com/?daddr=-23.5505,-46.6333&q=UBS%20Centro");
  });

  it("na web abre o Google Maps com a rota", () => {
    expect(directionsLink(u, "web")).toBe("https://www.google.com/maps/dir/?api=1&destination=-23.5505%2C-46.6333");
  });

  it("sem coordenadas, procura pelo endereço", () => {
    const s = unit("UBS Sem Mapa", null, null);
    const search = encodeURIComponent("Rua das Flores, 100, Centro, 01001-000");
    expect(directionsLink(s, "android")).toBe(`geo:0,0?q=${search}`);
    expect(directionsLink(s, "ios")).toBe(`https://maps.apple.com/?daddr=${search}`);
    expect(directionsLink(s, "web")).toBe(`https://www.google.com/maps/dir/?api=1&destination=${search}`);
  });
});
