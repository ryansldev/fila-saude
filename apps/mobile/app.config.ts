import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ConfigContext, ExpoConfig } from "expo/config";
import { googleServicesFile } from "./src/lib/push-setup.ts";

// O google-services.json fica fora do git (AD-071): em dev, o do Firebase de cada um;
// no EAS Build, a variável de arquivo GOOGLE_SERVICES_JSON (secreta). Sem ele, o build segue sem push.
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  // Marca pública de que o build levou a chave do Google Maps: a config gravada no build não leva
  // `android.config`, e o app decide por ela se mostra o mapa (ver `builtWithGoogleMaps`).
  extra: { ...config.extra, googleMaps: Boolean(process.env.GOOGLE_MAPS_ANDROID_API_KEY) },
  android: {
    ...config.android,
    googleServicesFile: googleServicesFile(
      process.env.GOOGLE_SERVICES_JSON,
      existsSync(join(__dirname, "google-services.json")),
    ),
    // Google Maps no Android (fora do Expo Go). Sem a chave, a aba de unidades mostra só a lista.
    ...(process.env.GOOGLE_MAPS_ANDROID_API_KEY
      ? { config: { ...config.android?.config, googleMaps: { apiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY } } }
      : {}),
  },
});
