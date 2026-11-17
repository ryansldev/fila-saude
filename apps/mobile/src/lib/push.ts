import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Linking, Platform } from "react-native";
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

export type PushResult = "registered" | "no_permission" | "no_project" | "simulator" | "error";

/**
 * "perguntar": o celular ainda não perguntou (a tela 3 explica antes de pedir).
 * "desligados": a pessoa negou; `canRequest` diz se o celular ainda mostra o pedido ou só os ajustes resolvem.
 */
export type NoticeState = { kind: "on" } | { kind: "ask" } | { kind: "off"; canRequest: boolean };

const fromStatus = (p: Notifications.NotificationPermissionsStatus): NoticeState =>
  p.granted
    ? { kind: "on" }
    : p.status === "undetermined"
      ? { kind: "ask" }
      : { kind: "off", canRequest: p.canAskAgain };

/** Nunca lança: sem como ler, trata como ligados para não travar a entrada. */
export async function noticeState(): Promise<NoticeState> {
  try {
    return fromStatus(await Notifications.getPermissionsAsync());
  } catch {
    return { kind: "on" };
  }
}

const createChannel = async () => {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("fila", {
    name: "fila",
    importance: Notifications.AndroidImportance.MAX,
    sound: "default",
  });
};

let registeredToken: string | null = null;

/** Ao sair da conta: tira este aparelho da lista de avisos dela. Nunca lança. */
export async function leavePush(api: Api): Promise<void> {
  if (!registeredToken) return;
  await api.del("/v1/patient/push", { token: registeredToken }).catch(() => {});
  registeredToken = null;
}

/**
 * Registra o token de push da Expo na conta (PUT /v1/paciente/push) se a permissão já foi dada; não pede.
 * O token da Expo exige o projectId do EAS (EXPO_PUBLIC_EAS_PROJECT_ID ou extra.eas.projectId):
 * sem ele o app segue só com a consulta da tela. Nunca lança.
 */
export async function registerPush(api: Api): Promise<PushResult> {
  try {
    if (!Device.isDevice) return "simulator";
    if (!(await Notifications.getPermissionsAsync()).granted) return "no_permission";
    await createChannel();
    const projectId =
      process.env.EXPO_PUBLIC_EAS_PROJECT_ID ??
      (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
    if (!projectId) return "no_project";
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    await api.put("/v1/patient/push", { token: data });
    registeredToken = data;
    return "registered";
  } catch {
    return "error";
  }
}

/**
 * Pede a permissão ou, se o celular não pergunta mais, abre os ajustes do app. Devolve o estado depois
 * do pedido; ao voltar dos ajustes, quem chamou lê de novo. Não registra o token. Nunca lança.
 */
export async function turnOnNotices(): Promise<NoticeState> {
  try {
    // Android 13+: o pedido só aparece depois de existir um canal.
    await createChannel();
    const current = await Notifications.getPermissionsAsync();
    if (!current.granted && current.status !== "undetermined" && !current.canAskAgain) {
      await Linking.openSettings();
      return fromStatus(current);
    }
    return fromStatus(current.granted ? current : await Notifications.requestPermissionsAsync());
  } catch {
    return noticeState();
  }
}
