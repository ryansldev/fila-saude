import { router } from "expo-router";
import { Bell, DoorOpen, House, type LucideIcon, Megaphone } from "lucide-react-native";
import { useState } from "react";
import { Text, View } from "react-native";
import { Botao, COR, FONTE, Tela, TextoSuave, Titulo } from "@/components/ui";
import { telaDosAvisos } from "@/lib/avisos";
import { useSessao } from "@/lib/sessao";

const EXEMPLOS: { texto: string; Icone: LucideIcon; fundo: string; cor: string }[] = [
  { texto: "hora de sair de casa", Icone: House, fundo: COR.warningBg, cor: COR.warningInk },
  { texto: "venha agora", Icone: DoorOpen, fundo: COR.primary50, cor: COR.action },
  { texto: "é a sua vez!", Icone: Megaphone, fundo: COR.successBg, cor: COR.successInk },
];

/**
 * Tela 3 do design: por que os avisos importam, antes do pedido do celular (que quase não volta a aparecer).
 * Pelo sininho do topo, a mesma tela mostra como estão os avisos e volta para onde a pessoa estava.
 */
export default function Avisos() {
  const s = useSessao();
  const [ligando, setLigando] = useState(false);
  const peloSininho = router.canGoBack();
  const seguir = () => (peloSininho ? router.back() : router.replace("/"));
  const t = telaDosAvisos(s.avisos ?? { tipo: "perguntar" });

  return (
    <Tela
      topo={false}
      acoes={
        <>
          {t.dica ? (
            <TextoSuave style={{ textAlign: "center", fontSize: 16, lineHeight: 22 }}>{t.dica}</TextoSuave>
          ) : null}
          {t.botao ? (
            <Botao
              texto={t.botao}
              carregando={ligando}
              onPress={async () => {
                setLigando(true);
                await s.ligarAvisos();
                setLigando(false);
                seguir();
              }}
            />
          ) : null}
          <Botao
            variante={t.botao ? "texto" : "principal"}
            texto={t.botao ? "agora não" : "voltar"}
            onPress={async () => {
              if (t.botao) await s.pularAvisos();
              seguir();
            }}
          />
        </>
      }
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ borderRadius: 28, backgroundColor: COR.surfaceMuted, padding: 20, gap: 12, alignItems: "center" }}
      >
        <View style={{ padding: 18, borderRadius: 999, backgroundColor: COR.amarelo, marginBottom: 4 }}>
          <Bell size={44} color="#ffffff" strokeWidth={2.75} />
        </View>
        {EXEMPLOS.map(({ texto, Icone, fundo, cor }) => (
          <View
            key={texto}
            style={{
              alignSelf: "stretch",
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingHorizontal: 14,
              paddingVertical: 12,
              borderRadius: 18,
              borderWidth: 2,
              borderBottomWidth: 4,
              borderColor: COR.linha,
              backgroundColor: COR.surface,
            }}
          >
            <View style={{ padding: 8, borderRadius: 12, backgroundColor: fundo }}>
              <Icone size={24} color={cor} strokeWidth={2.5} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: FONTE.extra, fontSize: 18, lineHeight: 24, color: COR.ink }}>{texto}</Text>
              <Text style={{ fontFamily: FONTE.semi, fontSize: 14, color: COR.inkMuted }}>fila saúde · agora</Text>
            </View>
          </View>
        ))}
      </View>
      <View style={{ gap: 8 }}>
        <Titulo style={{ fontSize: 30, lineHeight: 36 }}>{t.titulo}</Titulo>
        <TextoSuave style={{ fontSize: 20, lineHeight: 30 }}>{t.texto}</TextoSuave>
      </View>
    </Tela>
  );
}
