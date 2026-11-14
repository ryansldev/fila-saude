import type { UnidadePublica } from "@fila-saude/schemas/fila";

export type Ponto = { lat: number; lng: number };

const RAIO_DA_TERRA_KM = 6371;
const rad = (graus: number) => (graus * Math.PI) / 180;

/** Distância em linha reta (haversine), em km. A rua é um pouco mais longa: o número é uma estimativa. */
export function distanciaKm(a: Ponto, b: Ponto): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * RAIO_DA_TERRA_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Minutos a pé a 5 km/h (como no protótipo); nunca "0 min". */
export const minutosAPe = (km: number) => Math.max(1, Math.round((km / 5) * 60));

const umaCasa = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function textoKm(km: number): string {
  const metros = Math.max(50, Math.round((km * 1000) / 50) * 50);
  if (metros < 1000) return `${metros} m`;
  return km >= 10 ? `${Math.round(km)} km` : `${umaCasa.format(km)} km`;
}

function textoMinutos(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const resto = min % 60;
  return resto ? `${h} h ${resto} min` : `${h} h`;
}

/** "1,2 km · 15 min a pé". */
export const textoDistancia = (km: number) => `${textoKm(km)} · ${textoMinutos(minutosAPe(km))} a pé`;

export type UnidadeNaLista = { unidade: UnidadePublica; km: number | null };

const porNome = (a: UnidadePublica, b: UnidadePublica) =>
  a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" });

const pontoDa = (u: UnidadePublica): Ponto | null =>
  u.lat === null || u.lng === null ? null : { lat: u.lat, lng: u.lng };

/**
 * Com a localização da pessoa: da mais perto para a mais longe (as sem coordenadas no fim, por nome).
 * Sem a localização: em ordem alfabética, sem distância.
 */
export function ordenarUnidades(unidades: UnidadePublica[], aqui: Ponto | null): UnidadeNaLista[] {
  const lista = unidades.map((unidade) => {
    const p = pontoDa(unidade);
    return { unidade, km: aqui && p ? distanciaKm(aqui, p) : null };
  });
  return lista.sort((a, b) => {
    if (a.km !== null && b.km !== null) return a.km - b.km || porNome(a.unidade, b.unidade);
    if (a.km !== null) return -1;
    if (b.km !== null) return 1;
    return porNome(a.unidade, b.unidade);
  });
}

const TIPOS: Record<string, string> = {
  ubs: "posto de saúde (UBS)",
  policlinica: "policlínica",
  upa: "pronto atendimento (UPA)",
};

export const nomeDoTipo = (tipo: string) => TIPOS[tipo] ?? "unidade de saúde";

export const textoAtendimentos = (n: number) =>
  n === 0 ? "sem atendimento aberto agora" : n === 1 ? "1 atendimento aberto" : `${n} atendimentos abertos`;

const cep = (c: string) => {
  const d = c.replace(/\D/g, "");
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : c;
};

/** "Rua das Flores, 100 · Centro · CEP 01001-000". */
export const enderecoEmLinha = (e: UnidadePublica["endereco"]) =>
  `${e.logradouro}, ${e.numero} · ${e.bairro} · CEP ${cep(e.cep)}`;

/** Abre o app de mapas do celular com a rota até a unidade (pelas coordenadas ou, sem elas, pelo endereço). */
export function linkComoChegar(u: UnidadePublica, plataforma: string): string {
  const p = pontoDa(u);
  const { logradouro, numero, bairro } = u.endereco;
  const busca = encodeURIComponent(`${logradouro}, ${numero}, ${bairro}, ${cep(u.endereco.cep)}`);
  const nome = encodeURIComponent(u.nome);
  if (plataforma === "android") return p ? `geo:${p.lat},${p.lng}?q=${p.lat},${p.lng}(${nome})` : `geo:0,0?q=${busca}`;
  if (plataforma === "ios")
    return p ? `https://maps.apple.com/?daddr=${p.lat},${p.lng}&q=${nome}` : `https://maps.apple.com/?daddr=${busca}`;
  const destino = p ? encodeURIComponent(`${p.lat},${p.lng}`) : busca;
  return `https://www.google.com/maps/dir/?api=1&destination=${destino}`;
}
