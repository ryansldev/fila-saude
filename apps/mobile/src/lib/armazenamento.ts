import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// No celular, o token fica no SecureStore (Keychain/Keystore). No navegador (pré-visualização com
// `expo start --web`) o SecureStore não existe: usa o localStorage.
const web = Platform.OS === "web";

export async function ler(chave: string): Promise<string | null> {
  if (web) return globalThis.localStorage?.getItem(chave) ?? null;
  return SecureStore.getItemAsync(chave);
}

export async function gravar(chave: string, valor: string): Promise<void> {
  if (web) return void globalThis.localStorage?.setItem(chave, valor);
  return SecureStore.setItemAsync(chave, valor);
}

export async function apagar(chave: string): Promise<void> {
  if (web) return void globalThis.localStorage?.removeItem(chave);
  return SecureStore.deleteItemAsync(chave);
}
