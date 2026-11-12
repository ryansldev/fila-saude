import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ProvedorDeSessao } from "@/lib/sessao";

export default function Raiz() {
  return (
    <SafeAreaProvider>
      <ProvedorDeSessao>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerTitle: "", headerShadowVisible: false, headerBackTitle: "Voltar" }}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="entrar" options={{ headerShown: false }} />
          <Stack.Screen name="inicio" options={{ headerShown: false }} />
          <Stack.Screen name="check-in" options={{ headerShown: false }} />
        </Stack>
      </ProvedorDeSessao>
    </SafeAreaProvider>
  );
}
