import type { PublicUnit } from "@fila-saude/schemas/queue";

export type Point = { lat: number; lng: number };

const EARTH_RADIUS_KM = 6371;
const rad = (degrees: number) => (degrees * Math.PI) / 180;

/** Distância em linha reta (haversine), em km. A rua é um pouco mais longa: o número é uma estimativa. */
export function distanceKm(a: Point, b: Point): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Minutos a pé a 5 km/h (como no protótipo); nunca "0 min". */
export const walkingMinutes = (km: number) => Math.max(1, Math.round((km / 5) * 60));

const oneHome = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function textKm(km: number): string {
  const meters = Math.max(50, Math.round((km * 1000) / 50) * 50);
  if (meters < 1000) return `${meters} m`;
  return km >= 10 ? `${Math.round(km)} km` : `${oneHome.format(km)} km`;
}

function textMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const rest = min % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

/** "1,2 km · 15 min a pé". */
export const distanceText = (km: number) => `${textKm(km)} · ${textMinutes(walkingMinutes(km))} a pé`;

export type UnitInList = { unit: PublicUnit; km: number | null };

const byName = (a: PublicUnit, b: PublicUnit) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });

const pointOf = (u: PublicUnit): Point | null => (u.lat === null || u.lng === null ? null : { lat: u.lat, lng: u.lng });

/**
 * Com a localização da pessoa: da mais perto para a mais longe (as sem coordenadas no fim, por nome).
 * Sem a localização: em ordem alfabética, sem distância.
 */
export function sortUnits(units: PublicUnit[], here: Point | null): UnitInList[] {
  const list = units.map((unit) => {
    const p = pointOf(unit);
    return { unit, km: here && p ? distanceKm(here, p) : null };
  });
  return list.sort((a, b) => {
    if (a.km !== null && b.km !== null) return a.km - b.km || byName(a.unit, b.unit);
    if (a.km !== null) return -1;
    if (b.km !== null) return 1;
    return byName(a.unit, b.unit);
  });
}

const KINDS: Record<string, string> = {
  ubs: "posto de saúde (UBS)",
  polyclinic: "policlínica",
  upa: "pronto atendimento (UPA)",
};

export const kindName = (kind: string) => KINDS[kind] ?? "unidade de saúde";

export const appointmentsText = (n: number) => (n === 0 ? "sem vaga agora" : n === 1 ? "1 aberto" : `${n} abertos`);

const postalCode = (c: string) => {
  const d = c.replace(/\D/g, "");
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : c;
};

/** "Rua das Flores, 100 · Centro · CEP 01001-000". */
export const rowAddress = (e: PublicUnit["address"]) =>
  `${e.street}, ${e.number} · ${e.neighborhood} · CEP ${postalCode(e.postalCode)}`;

/** Abre o app de mapas do celular com a rota até a unidade (pelas coordenadas ou, sem elas, pelo endereço). */
export function directionsLink(u: PublicUnit, platform: string): string {
  const p = pointOf(u);
  const { street, number, neighborhood } = u.address;
  const search = encodeURIComponent(`${street}, ${number}, ${neighborhood}, ${postalCode(u.address.postalCode)}`);
  const name = encodeURIComponent(u.name);
  if (platform === "android") return p ? `geo:${p.lat},${p.lng}?q=${p.lat},${p.lng}(${name})` : `geo:0,0?q=${search}`;
  if (platform === "ios")
    return p ? `https://maps.apple.com/?daddr=${p.lat},${p.lng}&q=${name}` : `https://maps.apple.com/?daddr=${search}`;
  const destination = p ? encodeURIComponent(`${p.lat},${p.lng}`) : search;
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
}
