/**
 * Caminho do google-services.json (AD-071): no EAS, o arquivo da variável GOOGLE_SERVICES_JSON;
 * em dev, o do Firebase de cada um, se existir. Sem nenhum, fica de fora e o build segue sem push.
 */
export function googleServicesFile(fromEnv: string | undefined, localExists: boolean): string | undefined {
  if (fromEnv) return fromEnv;
  return localExists ? "./google-services.json" : undefined;
}

export type PushTarget = { projectId: string } | "simulator" | "expo_go" | "no_project";

/**
 * O token da Expo só sai num aparelho e com o projeto EAS. O Expo Go no Android não tem push remoto
 * desde o SDK 53 (o expo-notifications lança); no iPhone ainda tem.
 */
export function pushTarget(env: {
  isDevice: boolean;
  expoGo: boolean;
  os: string;
  projectId: string | undefined;
}): PushTarget {
  if (!env.isDevice) return "simulator";
  if (env.expoGo && env.os === "android") return "expo_go";
  return env.projectId ? { projectId: env.projectId } : "no_project";
}
