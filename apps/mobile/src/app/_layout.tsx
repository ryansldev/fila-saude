import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/nunito";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Carregando } from "@/components/ui";
import { ProvedorDeSessao } from "@/lib/sessao";

export default function Raiz() {
  const [prontas] = useFonts({ Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold });
  if (!prontas) return <Carregando cheia />;
  return (
    <SafeAreaProvider>
      <ProvedorDeSessao>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#ffffff" } }} />
      </ProvedorDeSessao>
    </SafeAreaProvider>
  );
}
