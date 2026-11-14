import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import type { Api } from "./api";

// T3.8: o aviso aparece mesmo com o app aberto.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export type ResultadoDoPush = "registrado" | "sem_permissao" | "sem_projeto" | "simulador" | "erro";

/**
 * Pede a permissão e registra o token de push da Expo na conta (PUT /v1/paciente/push).
 * O token da Expo exige o projectId do EAS (EXPO_PUBLIC_EAS_PROJECT_ID ou extra.eas.projectId):
 * sem ele o app segue só com a consulta da tela. Nunca lança.
 */
let tokenRegistrado: string | null = null;

/** Ao sair da conta: tira este aparelho da lista de avisos dela. Nunca lança. */
export async function sairDoPush(api: Api): Promise<void> {
  if (!tokenRegistrado) return;
  await api.del("/v1/paciente/push", { token: tokenRegistrado }).catch(() => {});
  tokenRegistrado = null;
}

export async function registrarPush(api: Api): Promise<ResultadoDoPush> {
  try {
    if (!Device.isDevice) return "simulador";
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("fila", {
        name: "fila",
        importance: Notifications.AndroidImportance.MAX,
        sound: "default",
      });
    }
    const atual = await Notifications.getPermissionsAsync();
    const permissao = atual.granted ? atual : await Notifications.requestPermissionsAsync();
    if (!permissao.granted) return "sem_permissao";
    const projectId =
      process.env.EXPO_PUBLIC_EAS_PROJECT_ID ??
      (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
    if (!projectId) return "sem_projeto";
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    await api.put("/v1/paciente/push", { token: data });
    tokenRegistrado = data;
    return "registrado";
  } catch {
    return "erro";
  }
}
