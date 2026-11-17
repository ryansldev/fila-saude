import { router } from "expo-router";
import { ChevronRight, MapPin } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Badge, Banner, COLOR, FONT, Loading, Screen, SoftText, TappableArea, Title } from "@/components/ui";
import { type Municipality, municipalityLabel } from "@/lib/account";
import { useSession } from "@/lib/session";
import { errorNotice } from "@/lib/texts";

/** AD-028: um app só; a pessoa escolhe o município (na primeira vez ou pela aba "conta"). */
export default function ChooseMunicipality() {
  const s = useSession();
  const [list, setList] = useState<Municipality[] | null>(null);
  const [error, setError] = useState<{ title: string; text: string } | null>(null);
  const [trying, setTrying] = useState(false);
  // Um toque só: dois toques seguidos não trocam de município duas vezes.
  const [choosing, setChoosing] = useState<string | null>(null);
  const switching = Boolean(s.municipality);

  const fetch = useCallback(
    () =>
      s.api
        .get<Municipality[]>("/v1/municipalities")
        .then((l) => {
          setList(l);
          setError(null);
        })
        .catch((err) => setError(errorNotice(err, "confira a conexão e tente de novo."))),
    [s.api],
  );
  useEffect(() => {
    void fetch();
  }, [fetch]);

  // Volta para onde a pessoa estava (a conta, por exemplo); na primeira escolha, vai para "hoje".
  const follow = () => {
    if (switching && router.canGoBack()) router.back();
    else router.replace("/inicio");
  };

  async function choose(m: Municipality) {
    if (choosing) return;
    if (m.slug === s.municipality) return follow();
    setChoosing(m.slug);
    try {
      await s.chooseMunicipality(m.slug);
      follow();
    } catch (err) {
      setError(errorNotice(err, "confira a conexão e tente de novo."));
    } finally {
      setChoosing(null);
    }
  }

  return (
    <Screen back={switching}>
      <Title>{switching ? "trocar de município" : "qual é o seu município?"}</Title>
      <SoftText>você vê as unidades e os atendimentos da cidade que escolher.</SoftText>
      {error ? (
        <Banner
          kind="danger"
          title={error.title}
          text={error.text}
          action={{
            text: "tentar de novo",
            loading: trying,
            onPress: async () => {
              setTrying(true);
              await fetch();
              setTrying(false);
            },
          }}
        />
      ) : null}
      {list === null && !error ? <Loading text="buscando os municípios…" /> : null}
      {list?.length === 0 ? (
        <SoftText style={{ textAlign: "center", paddingVertical: 24 }}>
          nenhum município usa o fila saúde ainda. na dúvida, pergunte na sua unidade de saúde.
        </SoftText>
      ) : null}
      {list?.map((m) => {
        const current = m.slug === s.municipality;
        const loading = choosing === m.slug;
        return (
          <TappableArea
            key={m.slug}
            label={municipalityLabel(m)}
            hint={current ? "é o seu município agora" : "escolher este município"}
            selected={current}
            busy={loading}
            disabled={Boolean(choosing)}
            onPress={() => void choose(m)}
            style={(pressed) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
              minHeight: 76,
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderRadius: 20,
              borderWidth: 2,
              borderBottomWidth: 4,
              borderColor: current || pressed ? COLOR.action : COLOR.line,
              backgroundColor: current || pressed ? COLOR.primary50 : COLOR.surface,
            })}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: current ? COLOR.surface : COLOR.primary50,
              }}
            >
              <MapPin size={26} color={COLOR.action} strokeWidth={2.5} />
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ fontFamily: FONT.extra, fontSize: 20, lineHeight: 26, color: COLOR.ink }}>
                {municipalityLabel(m)}
              </Text>
              {current ? <Badge text="atual" tone="green" /> : null}
            </View>
            {loading ? (
              <ActivityIndicator color={COLOR.action} />
            ) : (
              <ChevronRight size={26} color={current ? COLOR.action : COLOR.inkMuted} strokeWidth={2.5} />
            )}
          </TappableArea>
        );
      })}
    </Screen>
  );
}
