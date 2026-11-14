import { router } from "expo-router";
import { Text, View } from "react-native";
import { Botao, COR, FONTE, LinkBotao, Logo, Mascote, Tela, TextoSuave, Titulo } from "@/components/ui";

/** Primeira tela de quem está sem conta: a promessa do app em uma frase. */
export default function BoasVindas() {
  return (
    <Tela
      topo={false}
      acoes={
        <>
          <Botao texto="começar" onPress={() => router.push("/conhecer")} />
          <LinkBotao texto="já tenho conta" onPress={() => router.push("/entrar")} />
        </>
      }
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingTop: 8 }}>
        <Logo />
        <Text style={{ fontFamily: FONTE.extra, fontSize: 20, color: COR.ink }}>fila saúde</Text>
      </View>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16 }}>
        <Mascote tamanho={220} />
        <Titulo style={{ fontSize: 34, lineHeight: 40, textAlign: "center" }}>
          espere em casa, não <Text style={{ color: COR.action }}>no postinho.</Text>
        </Titulo>
        <TextoSuave style={{ fontSize: 20, lineHeight: 30, textAlign: "center" }}>
          você entra na fila pelo celular e a gente avisa a hora de sair de casa.
        </TextoSuave>
      </View>
    </Tela>
  );
}
