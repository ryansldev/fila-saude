/**
 * Endereço da API, de `EXPO_PUBLIC_API_URL` em apps/mobile/.env (modelo em .env.example): no celular,
 * o IP da máquina na rede (ex.: http://192.168.0.10:3333);
 * no emulador Android, http://10.0.2.2:3333.
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3333";

/** PD-33: a tela da vez consulta a cada ~3 s (o WebSocket entra depois no lugar). */
export const QUERY_INTERVAL_MS = 3_000;
