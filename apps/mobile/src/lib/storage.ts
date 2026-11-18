import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// No celular, o token fica no SecureStore (Keychain/Keystore). No navegador (pré-visualização com
// `expo start --web`) o SecureStore não existe: usa o localStorage.
const web = Platform.OS === "web";

export async function read(key: string): Promise<string | null> {
  if (web) return globalThis.localStorage?.getItem(key) ?? null;
  return SecureStore.getItemAsync(key);
}

export async function save(key: string, value: string): Promise<void> {
  if (web) return void globalThis.localStorage?.setItem(key, value);
  return SecureStore.setItemAsync(key, value);
}

export async function erase(key: string): Promise<void> {
  if (web) return void globalThis.localStorage?.removeItem(key);
  return SecureStore.deleteItemAsync(key);
}
