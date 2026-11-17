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
import { NoticeBell } from "@/components/care";
import { HeaderRight, Loading } from "@/components/ui";
import { SessionProvider } from "@/lib/session";

export default function Root() {
  const [ready] = useFonts({ Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold });
  if (!ready) return <Loading full />;
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <HeaderRight value={<NoticeBell />}>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#ffffff" } }} />
        </HeaderRight>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
