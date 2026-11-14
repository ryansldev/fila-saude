import { router } from "expo-router";
import { Text, View } from "react-native";
import { Botao, COR, Espaco, LinkBotao, Mascote, Tela, TextoSuave, Titulo } from "@/components/ui";

export default function BoasVindas() {
  return (
    <Tela topo={false}>
      <View style={{ alignItems: "center", gap: 16, paddingTop: 32 }}>
        <Mascote tamanho={200} />
        <Titulo style={{ fontSize: 32, lineHeight: 38, textAlign: "center" }}>
          chega de esperar horas no <Text style={{ color: COR.action }}>postinho.</Text>
        </Titulo>
        <TextoSuave style={{ textAlign: "center" }}>
          espere em casa. a gente te avisa quando estiver perto da sua vez.
        </TextoSuave>
      </View>
      <Espaco />
      <View style={{ gap: 8 }}>
        <Botao texto="começar" onPress={() => router.push("/cadastro")} />
        <LinkBotao texto="já tenho conta" onPress={() => router.push("/entrar")} />
      </View>
    </Tela>
  );
}
