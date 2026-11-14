import type { UnidadePublica } from "@fila-saude/schemas/fila";
import * as Location from "expo-location";
import { router, useFocusEffect } from "expo-router";
import { Building2, Footprints, LocateFixed } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Linking, Platform, Text, View } from "react-native";
import Mapa, { corDoPino } from "@/components/mapa";
import type { PinoDoMapa } from "@/components/mapa.tipos";
import {
  Abas,
  Avatar,
  Botao,
  Carregando,
  Cartao,
  COR,
  Faixa,
  FONTE,
  LinhaTocavel,
  LinkBotao,
  Pequeno,
  Selo,
  Tela,
  Texto,
  TextoSuave,
  Titulo,
} from "@/components/ui";
import { useSessao } from "@/lib/sessao";
import { avisoDoErro } from "@/lib/textos";
import {
  nomeDoTipo,
  ordenarUnidades,
  type Ponto,
  textoAtendimentos,
  textoDistancia,
  type UnidadeNaLista,
} from "@/lib/unidades";

type Localizacao =
  | { estado: "conferindo" }
  | { estado: "nao_pedida" }
  | { estado: "pedindo" }
  | { estado: "ok"; ponto: Ponto }
  /** `bloqueada`: o celular não pergunta mais; só nas configurações. */
  | { estado: "negada"; bloqueada: boolean }
  | { estado: "indisponivel" };

async function posicaoAtual(): Promise<Ponto | null> {
  try {
    const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { lat: p.coords.latitude, lng: p.coords.longitude };
  } catch {
    const ultima = await Location.getLastKnownPositionAsync().catch(() => null);
    return ultima ? { lat: ultima.coords.latitude, lng: ultima.coords.longitude } : null;
  }
}

/**
 * A localização só é pedida quando a pessoa toca em "usar minha localização" (com a explicação antes).
 * Se ela já deixou antes, a lista já abre da mais perto para a mais longe, sem perguntar de novo.
 */
function useLocalizacao() {
  const [loc, setLoc] = useState<Localizacao>({ estado: "conferindo" });

  useEffect(() => {
    let vivo = true;
    Location.getForegroundPermissionsAsync()
      .then(async (perm) => {
        if (!perm.granted) {
          if (vivo) setLoc(perm.canAskAgain ? { estado: "nao_pedida" } : { estado: "negada", bloqueada: true });
          return;
        }
        const ponto = await posicaoAtual();
        if (vivo) setLoc(ponto ? { estado: "ok", ponto } : { estado: "indisponivel" });
      })
      .catch(() => vivo && setLoc({ estado: "nao_pedida" }));
    return () => {
      vivo = false;
    };
  }, []);

  const pedir = useCallback(async () => {
    setLoc({ estado: "pedindo" });
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        setLoc({ estado: "negada", bloqueada: !perm.canAskAgain });
        return;
      }
      const ponto = await posicaoAtual();
      setLoc(ponto ? { estado: "ok", ponto } : { estado: "indisponivel" });
    } catch {
      setLoc({ estado: "indisponivel" });
    }
  }, []);

  return { loc, pedir };
}

/** O pedido de localização, explicado antes (nunca de surpresa ao abrir a tela). */
function PedidoDeLocalizacao({ loc, pedir }: { loc: Localizacao; pedir: () => void }) {
  if (loc.estado === "conferindo" || loc.estado === "ok") return null;
  if (loc.estado === "nao_pedida" || loc.estado === "pedindo")
    return (
      <Cartao style={{ gap: 12, backgroundColor: COR.primary50, borderColor: COR.primary50 }}>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <LocateFixed size={30} color={COR.action} strokeWidth={2.5} />
          <Text style={{ flex: 1, fontFamily: FONTE.extra, fontSize: 20, lineHeight: 26, color: COR.ink }}>
            ver as unidades mais perto de você
          </Text>
        </View>
        <TextoSuave>
          o app usa a sua localização só nesta tela, para pôr as unidades em ordem de distância. ela não é guardada.
        </TextoSuave>
        <Botao texto="usar minha localização" carregando={loc.estado === "pedindo"} onPress={pedir} />
      </Cartao>
    );
  return (
    <View style={{ gap: 0 }}>
      <Pequeno>
        {loc.estado === "negada"
          ? "sem a sua localização, as unidades estão em ordem alfabética."
          : "não deu para saber onde você está. as unidades estão em ordem alfabética."}
      </Pequeno>
      {loc.estado === "negada" && loc.bloqueada && Platform.OS !== "web" ? (
        <LinkBotao texto="permitir nas configurações" onPress={() => void Linking.openSettings()} />
      ) : loc.estado !== "negada" || !loc.bloqueada ? (
        <LinkBotao texto="tentar de novo" onPress={pedir} />
      ) : null}
    </View>
  );
}

function LinhaDaUnidade({ item, destaque = false }: { item: UnidadeNaLista; destaque?: boolean }) {
  const { unidade: u, km } = item;
  const aberta = u.atendimentos > 0;
  return (
    <LinhaTocavel
      acao={aberta ? "ver os atendimentos" : "ver a unidade"}
      onPress={() => router.push({ pathname: "/unidade/[id]", params: { id: u.id } })}
      esquerda={<Avatar Icone={Building2} tom={aberta ? "verde" : "cinza"} />}
    >
      {destaque ? <Selo texto="no mapa" tom="amarelo" /> : null}
      <Text style={{ fontFamily: FONTE.extra, fontSize: 20, lineHeight: 26, color: COR.ink }}>{u.nome}</Text>
      <Pequeno>
        {nomeDoTipo(u.tipo)} · {u.endereco.bairro}
      </Pequeno>
      {km !== null ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Footprints size={18} color={COR.ink} strokeWidth={2.25} />
          <Text style={{ fontFamily: FONTE.bold, fontSize: 16, lineHeight: 22, color: COR.ink }}>
            {textoDistancia(km)}
          </Text>
        </View>
      ) : null}
      <Selo texto={textoAtendimentos(u.atendimentos)} tom={aberta ? "verde" : "cinza"} />
    </LinhaTocavel>
  );
}

function Legenda() {
  const item = (aberto: boolean, texto: string) => (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 12, height: 12, borderRadius: 999, backgroundColor: corDoPino(aberto) }} />
      <Pequeno>{texto}</Pequeno>
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
export default function Unidades() {
  const s = useSessao();
  const [unidades, setUnidades] = useState<UnidadePublica[] | null>(null);
  const [erro, setErro] = useState<{ titulo: string; texto: string } | null>(null);
  const [tentando, setTentando] = useState(false);
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const { loc, pedir } = useLocalizacao();

  const buscar = useCallback(
    () =>
      s.api
        .get<UnidadePublica[]>(`/v1/municipios/${s.municipio}/unidades`)
        .then((l) => {
          setUnidades(l);
          setErro(null);
        })
        .catch((err) => setErro(avisoDoErro(err, "confira a conexão e tente de novo."))),
    [s.api, s.municipio],
  );
  // Volta à aba: busca de novo (o número de atendimentos abertos muda).
  useFocusEffect(
    useCallback(() => {
      void buscar();
    }, [buscar]),
  );

  const aqui = loc.estado === "ok" ? loc.ponto : null;
  const lista = useMemo(() => ordenarUnidades(unidades ?? [], aqui), [unidades, aqui]);
  const pinos = useMemo<PinoDoMapa[]>(
    () =>
      (unidades ?? []).flatMap((u) =>
        u.lat === null || u.lng === null
          ? []
          : [{ id: u.id, nome: u.nome, lat: u.lat, lng: u.lng, aberto: u.atendimentos > 0 }],
      ),
    [unidades],
  );
  const escolhida = lista.find((x) => x.unidade.id === selecionada);

  return (
    <Tela voltar={false} rodape={<Abas atual="unidades" />}>
      <Titulo>unidades perto de você</Titulo>
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
      {unidades === null && !erro ? <Carregando texto="buscando as unidades…" /> : null}
      {unidades && pinos.length > 0 ? (
        <>
          <Mapa
            pinos={pinos}
            aqui={aqui}
            selecionado={selecionada}
            aoTocarPino={(id) => setSelecionada((atual) => (atual === id ? null : id))}
            aoTocarFora={() => setSelecionada(null)}
          />
          <Legenda />
        </>
      ) : null}
      {/* Tocou num pino: a unidade aparece logo embaixo do mapa, sem precisar rolar a lista. */}
      {escolhida ? <LinhaDaUnidade item={escolhida} destaque /> : null}
      {unidades && unidades.length > 0 ? <PedidoDeLocalizacao loc={loc} pedir={() => void pedir()} /> : null}
      {unidades?.length === 0 ? (
        <View style={{ gap: 4, paddingVertical: 24 }}>
          <Texto style={{ fontFamily: FONTE.bold, textAlign: "center" }}>nenhuma unidade no app ainda</Texto>
          <TextoSuave style={{ textAlign: "center" }}>
            as unidades do seu município aparecem aqui quando entram no fila saúde.
          </TextoSuave>
        </View>
      ) : null}
      {lista.length > 0 ? (
        <Text style={{ fontFamily: FONTE.extra, fontSize: 18, color: COR.inkMuted, marginBottom: -6 }}>
          {aqui ? "da mais perto para a mais longe" : "todas as unidades"}
        </Text>
      ) : null}
      {lista
        .filter((x) => x.unidade.id !== selecionada)
        .map((x) => (
          <LinhaDaUnidade key={x.unidade.id} item={x} />
        ))}
      {aqui && lista.length > 0 ? (
        <Pequeno style={{ textAlign: "center" }}>distância em linha reta; a pé pode levar um pouco mais.</Pequeno>
      ) : null}
    </Tela>
  );
}
