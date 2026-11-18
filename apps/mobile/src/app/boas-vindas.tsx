import { router } from "expo-router";
import { Text, View } from "react-native";
import { Button, COLOR, FONT, Logo, Mascot, Screen, SoftText, Title } from "@/components/ui";

/** Primeira tela de quem está sem conta: a promessa do app em uma frase. */
export default function Welcome() {
  return (
    <Screen
      top={false}
      actions={
        <>
          <Button text="começar" onPress={() => router.push("/conhecer")} />
          <Button variant="text" text="já tenho conta" onPress={() => router.push("/entrar")} />
        </>
      }
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingTop: 8 }}>
        <Logo />
        <Text style={{ fontFamily: FONT.extra, fontSize: 20, color: COLOR.ink }}>fila saúde</Text>
      </View>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16 }}>
        <Mascot size={220} />
        <Title style={{ fontSize: 34, lineHeight: 40, textAlign: "center" }}>
          espere em casa, não <Text style={{ color: COLOR.action }}>no postinho.</Text>
        </Title>
        <SoftText style={{ fontSize: 20, lineHeight: 30, textAlign: "center" }}>
          você entra na fila pelo celular e a gente avisa a hora de sair de casa.
        </SoftText>
      </View>
    </Screen>
  );
}
