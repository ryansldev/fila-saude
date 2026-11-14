import type { UnidadePublica } from "@fila-saude/schemas/fila";
import { describe, expect, it } from "vitest";
import {
  distanciaKm,
  enderecoEmLinha,
  linkComoChegar,
  minutosAPe,
  nomeDoTipo,
  ordenarUnidades,
  textoAtendimentos,
  textoDistancia,
} from "@/lib/unidades";

const SE = { lat: -23.5505, lng: -46.6333 };

const unidade = (nome: string, lat: number | null, lng: number | null, extra: Partial<UnidadePublica> = {}) =>
  ({
    id: `00000000-0000-4000-8000-${nome.length.toString().padStart(12, "0")}`,
    nome,
    tipo: "ubs",
    endereco: { logradouro: "Rua das Flores", numero: "100", bairro: "Centro", cep: "01001000" },
    lat,
    lng,
    atendimentos: 0,
    ...extra,
  }) satisfies UnidadePublica;

describe("distanciaKm (haversine)", () => {
  it("é zero no mesmo ponto", () => {
    expect(distanciaKm(SE, SE)).toBe(0);
  });

  it("da Sé à Paulista dá uns 2,6 km em linha reta", () => {
    expect(distanciaKm(SE, { lat: -23.5613, lng: -46.6565 })).toBeCloseTo(2.66, 1);
  });

  it("um grau de latitude dá uns 111 km", () => {
    expect(distanciaKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111.19, 1);
  });

  it("é simétrica", () => {
    const a = { lat: -23.5531, lng: -46.6528 };
    expect(distanciaKm(SE, a)).toBeCloseTo(distanciaKm(a, SE), 9);
  });
});

describe("minutosAPe (5 km/h)", () => {
  it("1 km dá 12 minutos", () => {
    expect(minutosAPe(1)).toBe(12);
  });

  it("arredonda para o minuto mais perto", () => {
    expect(minutosAPe(1.2)).toBe(14);
    expect(minutosAPe(2.66)).toBe(32);
  });

  it("nunca diz 0 minutos", () => {
    expect(minutosAPe(0)).toBe(1);
    expect(minutosAPe(0.02)).toBe(1);
  });
});

describe("textoDistancia", () => {
  it("km com vírgula e uma casa, e os minutos a pé", () => {
    expect(textoDistancia(1.23)).toBe("1,2 km · 15 min a pé");
  });

  it("perto de 1 km ou menos, em metros redondos", () => {
    expect(textoDistancia(0.34)).toBe("350 m · 4 min a pé");
    expect(textoDistancia(0.01)).toBe("50 m · 1 min a pé");
  });

  it("longe, sem casa decimal e em horas", () => {
    expect(textoDistancia(12.4)).toBe("12 km · 2 h 29 min a pé");
  });
});

describe("ordenarUnidades", () => {
  const centro = unidade("UBS Centro", -23.5505, -46.6333);
  const sul = unidade("Policlínica Sul", -23.5613, -46.6565);
  const vila = unidade("UBS Vila Nova", -23.5531, -46.6528);
  const semMapa = unidade("Ambulatório Sem Mapa", null, null);

  it("com a localização, da mais perto para a mais longe, como no Uber", () => {
    const r = ordenarUnidades([sul, vila, centro], SE);
    expect(r.map((x) => x.unidade.nome)).toEqual(["UBS Centro", "UBS Vila Nova", "Policlínica Sul"]);
    expect(r[0]?.km).toBe(0);
    expect(r[2]?.km).toBeCloseTo(2.66, 1);
  });

  it("unidade sem coordenadas vai para o fim, sem distância", () => {
    const r = ordenarUnidades([semMapa, sul, centro], SE);
    expect(r.map((x) => x.unidade.nome)).toEqual(["UBS Centro", "Policlínica Sul", "Ambulatório Sem Mapa"]);
    expect(r[2]?.km).toBeNull();
  });

  it("sem a localização, em ordem alfabética (acentos e maiúsculas não atrapalham)", () => {
    const r = ordenarUnidades([vila, centro, unidade("úbs ágata", 1, 1), sul, semMapa], null);
    expect(r.map((x) => x.unidade.nome)).toEqual([
      "Ambulatório Sem Mapa",
      "Policlínica Sul",
      "úbs ágata",
      "UBS Centro",
      "UBS Vila Nova",
    ]);
    expect(r.every((x) => x.km === null)).toBe(true);
  });

  it("não mexe na lista recebida", () => {
    const lista = [sul, centro];
    ordenarUnidades(lista, SE);
    expect(lista).toEqual([sul, centro]);
  });
});

describe("textos da unidade", () => {
  it("nome do tipo em linguagem simples", () => {
    expect(nomeDoTipo("ubs")).toBe("posto de saúde (UBS)");
    expect(nomeDoTipo("policlinica")).toBe("policlínica");
    expect(nomeDoTipo("upa")).toBe("pronto atendimento (UPA)");
    expect(nomeDoTipo("outro")).toBe("unidade de saúde");
  });

  it("quantos atendimentos abertos", () => {
    expect(textoAtendimentos(0)).toBe("sem atendimento aberto agora");
    expect(textoAtendimentos(1)).toBe("1 atendimento aberto");
    expect(textoAtendimentos(3)).toBe("3 atendimentos abertos");
  });

  it("endereço numa linha, com o CEP formatado", () => {
    expect(enderecoEmLinha(unidade("x", 0, 0).endereco)).toBe("Rua das Flores, 100 · Centro · CEP 01001-000");
  });
});

describe("linkComoChegar", () => {
  const u = unidade("UBS Centro", -23.5505, -46.6333);

  it("no Android abre o app de mapas pelo geo:", () => {
    expect(linkComoChegar(u, "android")).toBe("geo:-23.5505,-46.6333?q=-23.5505,-46.6333(UBS%20Centro)");
  });

  it("no iPhone abre o Apple Maps com a rota", () => {
    expect(linkComoChegar(u, "ios")).toBe("https://maps.apple.com/?daddr=-23.5505,-46.6333&q=UBS%20Centro");
  });

  it("na web abre o Google Maps com a rota", () => {
    expect(linkComoChegar(u, "web")).toBe("https://www.google.com/maps/dir/?api=1&destination=-23.5505%2C-46.6333");
  });

  it("sem coordenadas, procura pelo endereço", () => {
    const s = unidade("UBS Sem Mapa", null, null);
    const busca = encodeURIComponent("Rua das Flores, 100, Centro, 01001-000");
    expect(linkComoChegar(s, "android")).toBe(`geo:0,0?q=${busca}`);
    expect(linkComoChegar(s, "ios")).toBe(`https://maps.apple.com/?daddr=${busca}`);
    expect(linkComoChegar(s, "web")).toBe(`https://www.google.com/maps/dir/?api=1&destination=${busca}`);
  });
});
