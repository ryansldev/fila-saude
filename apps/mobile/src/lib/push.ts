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

export type ResultadoDoPush = "registrado" | "sem_permissao" | "sem_projeto" | "simulador" | "erro";

/**
 * "perguntar": o celular ainda não perguntou (a tela 3 explica antes de pedir).
 * "desligados": a pessoa negou; `podePedir` diz se o celular ainda mostra o pedido ou só os ajustes resolvem.
 */
export type EstadoDosAvisos = { tipo: "ligados" } | { tipo: "perguntar" } | { tipo: "desligados"; podePedir: boolean };

const deStatus = (p: Notifications.NotificationPermissionsStatus): EstadoDosAvisos =>
  p.granted
    ? { tipo: "ligados" }
    : p.status === "undetermined"
      ? { tipo: "perguntar" }
      : { tipo: "desligados", podePedir: p.canAskAgain };

/** Nunca lança: sem como ler, trata como ligados para não travar a entrada. */
export async function estadoDosAvisos(): Promise<EstadoDosAvisos> {
  try {
    return deStatus(await Notifications.getPermissionsAsync());
  } catch {
    return { tipo: "ligados" };
  }
}

const criarCanal = async () => {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("fila", {
    name: "fila",
    importance: Notifications.AndroidImportance.MAX,
    sound: "default",
  });
};

let tokenRegistrado: string | null = null;

/** Ao sair da conta: tira este aparelho da lista de avisos dela. Nunca lança. */
export async function sairDoPush(api: Api): Promise<void> {
  if (!tokenRegistrado) return;
  await api.del("/v1/paciente/push", { token: tokenRegistrado }).catch(() => {});
  tokenRegistrado = null;
}

/**
 * Registra o token de push da Expo na conta (PUT /v1/paciente/push) se a permissão já foi dada; não pede.
 * O token da Expo exige o projectId do EAS (EXPO_PUBLIC_EAS_PROJECT_ID ou extra.eas.projectId):
 * sem ele o app segue só com a consulta da tela. Nunca lança.
 */
export async function registrarPush(api: Api): Promise<ResultadoDoPush> {
  try {
    if (!Device.isDevice) return "simulador";
    if (!(await Notifications.getPermissionsAsync()).granted) return "sem_permissao";
    await criarCanal();
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

/**
 * Pede a permissão ou, se o celular não pergunta mais, abre os ajustes do app. Devolve o estado depois
 * do pedido; ao voltar dos ajustes, quem chamou lê de novo. Não registra o token. Nunca lança.
 */
export async function ligarAvisos(): Promise<EstadoDosAvisos> {
  try {
    // Android 13+: o pedido só aparece depois de existir um canal.
    await criarCanal();
    const atual = await Notifications.getPermissionsAsync();
    if (!atual.granted && atual.status !== "undetermined" && !atual.canAskAgain) {
      await Linking.openSettings();
      return deStatus(atual);
    }
    return deStatus(atual.granted ? atual : await Notifications.requestPermissionsAsync());
  } catch {
    return estadoDosAvisos();
  }
}
