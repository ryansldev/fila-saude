import { router } from "expo-router";
import { Bell } from "lucide-react-native";
import { useState } from "react";
import { Text, View } from "react-native";
import { Botao, COR, Espaco, FONTE, LinkBotao, Mascote, Tela, TextoSuave, Titulo } from "@/components/ui";
import { useSessao } from "@/lib/sessao";

const EXEMPLOS = ["hora de sair de casa", "venha agora", "é a sua vez!"];

/** Tela 3 do design: por que os avisos importam, antes do pedido do celular (que quase não volta a aparecer). */
export default function Avisos() {
  const s = useSessao();
  const [ligando, setLigando] = useState(false);
  const seguir = () => router.replace("/");

  return (
    <Tela voltar={false}>
      <Mascote tamanho={140} />
      <Titulo>a gente te avisa a hora de sair de casa</Titulo>
      <TextoSuave>
        assim você espera em casa e não perde a sua vez. os avisos chegam mesmo com o app fechado:
      </TextoSuave>
      <View style={{ gap: 10 }}>
        {EXEMPLOS.map((t) => (
          <View
            key={t}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              padding: 14,
              borderRadius: 12,
              backgroundColor: COR.primary50,
            }}
          >
            <Bell size={24} color={COR.action} strokeWidth={2.5} />
            <Text style={{ fontFamily: FONTE.extra, fontSize: 18, lineHeight: 24, color: COR.ink }}>{t}</Text>
          </View>
        ))}
      </View>
      <TextoSuave>os avisos não mostram nada sobre a sua saúde.</TextoSuave>
      <Espaco />
      <View style={{ gap: 8 }}>
        <TextoSuave style={{ textAlign: "center" }}>na próxima tela, toque em “permitir”.</TextoSuave>
        <Botao
          texto="ligar os avisos"
          carregando={ligando}
          onPress={async () => {
            setLigando(true);
            await s.ligarAvisos();
            seguir();
          }}
        />
        <LinkBotao
          texto="agora não"
          cor={COR.inkMuted}
          onPress={async () => {
            await s.pularAvisos();
            seguir();
          }}
        />
      </View>
    </Tela>
  );
}
