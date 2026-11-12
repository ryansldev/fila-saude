/**
 * Endereço da API. No celular, use o IP da máquina na rede (ex.: EXPO_PUBLIC_API_URL=http://192.168.0.10:3333);
 * no emulador Android, http://10.0.2.2:3333.
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3333";

/** PD-33: a tela da vez consulta a cada ~3 s (o SSE entra depois no lugar). */
export const INTERVALO_DA_CONSULTA_MS = 3_000;
