import type { PublicUnit } from "@fila-saude/schemas/queue";
import * as Location from "expo-location";
import { router, useFocusEffect } from "expo-router";
import { Building2, Footprints, LocateFixed } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Linking, Platform, Text, View } from "react-native";
import { PatientTabs } from "@/components/care";
import UnitsMap, { hasMap } from "@/components/map";
import type { MapPin } from "@/components/map.types";
import {
  Avatar,
  Badge,
  Banner,
  BodyText,
  Button,
  Card,
  COLOR,
  FONT,
  Loading,
  Screen,
  Small,
  SoftText,
  TappableRow,
  Title,
} from "@/components/ui";
import { pinAppearance } from "@/lib/map";
import { useSession } from "@/lib/session";
import { errorNotice } from "@/lib/texts";
import { appointmentsText, distanceText, kindName, type Point, sortUnits, type UnitInList } from "@/lib/units";

type LocationState =
  | { state: "verifying" }
  | { state: "not_requested" }
  | { state: "requesting" }
  | { state: "ok"; point: Point }
  /** `bloqueada`: o celular não pergunta mais; só nas configurações. */
  | { state: "denied"; blocked: boolean }
  | { state: "unavailable" };

async function currentPosition(): Promise<Point | null> {
  try {
    const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { lat: p.coords.latitude, lng: p.coords.longitude };
  } catch {
    const last = await Location.getLastKnownPositionAsync().catch(() => null);
    return last ? { lat: last.coords.latitude, lng: last.coords.longitude } : null;
  }
}

/**
 * A localização só é pedida quando a pessoa toca em "usar minha localização" (com a explicação antes).
 * Se ela já deixou antes, a lista já abre da mais perto para a mais longe, sem perguntar de novo.
 */
function useLocation() {
  const [loc, setLoc] = useState<LocationState>({ state: "verifying" });

  useEffect(() => {
    let live = true;
    Location.getForegroundPermissionsAsync()
      .then(async (perm) => {
        if (!perm.granted) {
          if (live) setLoc(perm.canAskAgain ? { state: "not_requested" } : { state: "denied", blocked: true });
          return;
        }
        const point = await currentPosition();
        if (live) setLoc(point ? { state: "ok", point } : { state: "unavailable" });
      })
      .catch(() => live && setLoc({ state: "not_requested" }));
    return () => {
      live = false;
    };
  }, []);

  const request = useCallback(async () => {
    setLoc({ state: "requesting" });
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        setLoc({ state: "denied", blocked: !perm.canAskAgain });
        return;
      }
      const point = await currentPosition();
      setLoc(point ? { state: "ok", point } : { state: "unavailable" });
    } catch {
      setLoc({ state: "unavailable" });
    }
  }, []);

  return { loc, request };
}

/** O pedido de localização, explicado antes (nunca de surpresa ao abrir a tela). */
function LocationRequest({ loc, request }: { loc: LocationState; request: () => void }) {
  if (loc.state === "verifying" || loc.state === "ok") return null;
  if (loc.state === "not_requested" || loc.state === "requesting")
    return (
      <Card style={{ gap: 12, backgroundColor: COLOR.primary50, borderColor: COLOR.primary50 }}>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <LocateFixed size={30} color={COLOR.action} strokeWidth={2.5} />
          <Text style={{ flex: 1, fontFamily: FONT.extra, fontSize: 20, lineHeight: 26, color: COLOR.ink }}>
            ver as unidades mais perto de você
          </Text>
        </View>
        <SoftText>
          o app usa a sua localização só nesta tela, para pôr as unidades em ordem de distância. ela não é guardada.
        </SoftText>
        <Button text="usar minha localização" loading={loc.state === "requesting"} onPress={request} />
      </Card>
    );
  return (
    <View style={{ gap: 0 }}>
      <Small>
        {loc.state === "denied"
          ? "sem a sua localização, as unidades estão em ordem alfabética."
          : "não deu para saber onde você está. as unidades estão em ordem alfabética."}
      </Small>
      {loc.state === "denied" && loc.blocked && Platform.OS !== "web" ? (
        <Button variant="text" text="permitir nas configurações" onPress={() => void Linking.openSettings()} />
      ) : loc.state !== "denied" || !loc.blocked ? (
        <Button variant="text" text="tentar de novo" onPress={request} />
      ) : null}
    </View>
  );
}

function UnitRow({ item, highlight = false }: { item: UnitInList; highlight?: boolean }) {
  const { unit: u, km } = item;
  const open = u.appointments > 0;
  return (
    <TappableRow
      action={open ? "ver os atendimentos" : "ver a unidade"}
      onPress={() => router.push({ pathname: "/unidade/[id]", params: { id: u.id } })}
      left={<Avatar Icon={Building2} tone={open ? "green" : "gray"} />}
    >
      {highlight ? <Badge text="no mapa" tone="yellow" /> : null}
      <Text style={{ fontFamily: FONT.extra, fontSize: 20, lineHeight: 26, color: COLOR.ink }}>{u.name}</Text>
      <Small>
        {kindName(u.kind)} · {u.address.neighborhood}
      </Small>
      {km !== null ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Footprints size={18} color={COLOR.ink} strokeWidth={2.25} />
          <Text style={{ fontFamily: FONT.bold, fontSize: 16, lineHeight: 22, color: COLOR.ink }}>
            {distanceText(km)}
          </Text>
        </View>
      ) : null}
      <Badge text={appointmentsText(u.appointments)} tone={open ? "green" : "gray"} />
    </TappableRow>
  );
}

function Legend() {
  const item = (open: boolean, text: string) => (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 12, height: 12, borderRadius: 999, backgroundColor: pinAppearance(open, false).color }} />
      <Small>{text}</Small>
    </View>
  );
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 16, rowGap: 4, marginTop: -6 }}>
      {item(true, "com atendimento aberto")}
      {item(false, "sem atendimento agora")}
    </View>
  );
}

/** Aba "unidades": mapa em cima e, embaixo, as unidades da mais perto para a mais longe (como no Uber). */
export default function Units() {
  const s = useSession();
  const [units, setUnits] = useState<PublicUnit[] | null>(null);
  const [error, setError] = useState<{ title: string; text: string } | null>(null);
  const [trying, setTrying] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const { loc, request } = useLocation();

  const fetch = useCallback(
    () =>
      s.api
        .get<PublicUnit[]>(`/v1/municipalities/${s.municipality}/units`)
        .then((l) => {
          setUnits(l);
          setError(null);
        })
        .catch((err) => setError(errorNotice(err, "confira a conexão e tente de novo."))),
    [s.api, s.municipality],
  );
  // Volta à aba: busca de novo (o número de atendimentos abertos muda).
  useFocusEffect(
    useCallback(() => {
      void fetch();
    }, [fetch]),
  );

  const here = loc.state === "ok" ? loc.point : null;
  const list = useMemo(() => sortUnits(units ?? [], here), [units, here]);
  const pins = useMemo<MapPin[]>(
    () =>
      (units ?? []).flatMap((u) =>
        u.lat === null || u.lng === null
          ? []
          : [{ id: u.id, name: u.name, lat: u.lat, lng: u.lng, open: u.appointments > 0 }],
      ),
    [units],
  );
  const chosen = list.find((x) => x.unit.id === selected);

  return (
    // Sem conta (veio de "esqueci a senha"): sem as abas de quem tem conta, com o voltar para entrar.
    <Screen back={!s.token} footer={s.token ? <PatientTabs current="units" /> : undefined}>
      <Title>unidades perto de você</Title>
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
      {units === null && !error ? <Loading text="buscando as unidades…" /> : null}
      {hasMap && units && pins.length > 0 ? (
        <>
          <UnitsMap
            pins={pins}
            here={here}
            selected={selected}
            onTapPin={(id) => setSelected((current) => (current === id ? null : id))}
            onTapOutside={() => setSelected(null)}
          />
          <Legend />
        </>
      ) : null}
      {/* Tocou num pino: a unidade aparece logo embaixo do mapa, sem precisar rolar a lista. */}
      {chosen ? <UnitRow item={chosen} highlight /> : null}
      {units && units.length > 0 ? <LocationRequest loc={loc} request={() => void request()} /> : null}
      {units?.length === 0 ? (
        <View style={{ gap: 4, paddingVertical: 24 }}>
          <BodyText style={{ fontFamily: FONT.bold, textAlign: "center" }}>nenhuma unidade no app ainda</BodyText>
          <SoftText style={{ textAlign: "center" }}>
            as unidades do seu município aparecem aqui quando entram no fila saúde.
          </SoftText>
        </View>
      ) : null}
      {list.length > 0 ? (
        <Text style={{ fontFamily: FONT.extra, fontSize: 18, color: COLOR.inkMuted, marginBottom: -6 }}>
          {here ? "da mais perto para a mais longe" : "todas as unidades"}
        </Text>
      ) : null}
      {list
        .filter((x) => x.unit.id !== selected)
        .map((x) => (
          <UnitRow key={x.unit.id} item={x} />
        ))}
      {here && list.length > 0 ? (
        <Small style={{ textAlign: "center" }}>distância em linha reta; a pé pode levar um pouco mais.</Small>
      ) : null}
    </Screen>
  );
}
