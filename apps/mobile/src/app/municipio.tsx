import { router } from "expo-router";
import { ChevronRight, MapPin } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Carregando, COR, Faixa, FONTE, Selo, Tela, TextoSuave, Titulo } from "@/components/ui";
import { type Municipio, rotuloDoMunicipio } from "@/lib/conta";
import { useSessao } from "@/lib/sessao";
import { avisoDoErro } from "@/lib/textos";

/** AD-028: um app só; a pessoa escolhe o município (na primeira vez ou pela aba "conta"). */
export default function EscolherMunicipio() {
  const s = useSessao();
  const [lista, setLista] = useState<Municipio[] | null>(null);
  const [erro, setErro] = useState<{ titulo: string; texto: string } | null>(null);
  const [tentando, setTentando] = useState(false);
  // Um toque só: dois toques seguidos não trocam de município duas vezes.
  const [escolhendo, setEscolhendo] = useState<string | null>(null);
  const trocando = Boolean(s.municipio);

  const buscar = useCallback(
    () =>
      s.api
        .get<Municipio[]>("/v1/municipios")
        .then((l) => {
          setLista(l);
          setErro(null);
        })
        .catch((err) => setErro(avisoDoErro(err, "confira a conexão e tente de novo."))),
    [s.api],
  );
  useEffect(() => {
    void buscar();
  }, [buscar]);

  // Volta para onde a pessoa estava (a conta, por exemplo); na primeira escolha, vai para "hoje".
  const seguir = () => {
    if (trocando && router.canGoBack()) router.back();
    else router.replace("/inicio");
  };

  async function escolher(m: Municipio) {
    if (escolhendo) return;
    if (m.slug === s.municipio) return seguir();
    setEscolhendo(m.slug);
    try {
      await s.escolherMunicipio(m.slug);
      seguir();
    } catch (err) {
      setErro(avisoDoErro(err, "confira a conexão e tente de novo."));
    } finally {
      setEscolhendo(null);
    }
  }

  return (
    <Tela voltar={trocando}>
      <Titulo>{trocando ? "trocar de município" : "qual é o seu município?"}</Titulo>
      <TextoSuave>você vê as unidades e os atendimentos da cidade que escolher.</TextoSuave>
      {erro ? (
        <Faixa
          tipo="perigo"
          titulo={erro.titulo}
          texto={erro.texto}
          acao={{
            texto: "tentar de novo",
            carregando: tentando,
            onPress: async () => {
              setTentando(true);
              await buscar();
              setTentando(false);
            },
          }}
        />
      ) : null}
      {lista === null && !erro ? <Carregando texto="buscando os municípios…" /> : null}
      {lista?.length === 0 ? (
        <TextoSuave style={{ textAlign: "center", paddingVertical: 24 }}>
          nenhum município usa o fila saúde ainda. na dúvida, pergunte na sua unidade de saúde.
        </TextoSuave>
      ) : null}
      {lista?.map((m) => {
        const atual = m.slug === s.municipio;
        const carregando = escolhendo === m.slug;
        return (
          <Pressable
            key={m.slug}
            accessibilityRole="button"
            accessibilityLabel={rotuloDoMunicipio(m)}
            accessibilityHint={atual ? "é o seu município agora" : "escolher este município"}
            accessibilityState={{ selected: atual, busy: carregando }}
            disabled={Boolean(escolhendo)}
            onPress={() => void escolher(m)}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
              minHeight: 76,
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderRadius: 20,
              borderWidth: 2,
              borderBottomWidth: 4,
              borderColor: atual || pressed ? COR.action : COR.linha,
              backgroundColor: atual || pressed ? COR.primary50 : COR.surface,
            })}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: atual ? COR.surface : COR.primary50,
              }}
            >
              <MapPin size={26} color={COR.action} strokeWidth={2.5} />
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ fontFamily: FONTE.extra, fontSize: 20, lineHeight: 26, color: COR.ink }}>
                {rotuloDoMunicipio(m)}
              </Text>
              {atual ? <Selo texto="atual" tom="verde" /> : null}
            </View>
            {carregando ? (
              <ActivityIndicator color={COR.action} />
            ) : (
              <ChevronRight size={26} color={atual ? COR.action : COR.inkMuted} strokeWidth={2.5} />
            )}
          </Pressable>
        );
      })}
    </Tela>
  );
}
