import { router } from "expo-router";
import {
  BellOff,
  BellRing,
  ChevronRight,
  CircleQuestionMark,
  Lightbulb,
  LogOut,
  type LucideIcon,
  MapPin,
} from "lucide-react-native";
import { type ReactNode, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Abas, Botao, COR, FONTE, Gaveta, Pequeno, Selo, Tela, TextoSuave, Titulo } from "@/components/ui";
import { cpfEscondido, iniciais, type Municipio, nomeDoMunicipio, primeiroNome, textoDosAvisos } from "@/lib/conta";
import { useSessao } from "@/lib/sessao";

/** Aba "conta": quem está no app e um menu simples, como no gov.br e no Meu SUS Digital. */
export default function Conta() {
  const s = useSessao();
  const [municipios, setMunicipios] = useState<Municipio[] | null>(null);
  const [ligando, setLigando] = useState(false);
  const [confirmarSaida, setConfirmarSaida] = useState(false);
  const [saindo, setSaindo] = useState(false);

  useEffect(() => {
    s.api
      .get<Municipio[]>("/v1/municipios")
      .then(setMunicipios)
      .catch(() => setMunicipios([]));
  }, [s.api]);

  const nomeMunicipio = nomeDoMunicipio(municipios, s.municipio);
  const avisos = textoDosAvisos(s.avisos);
  const cpf = cpfEscondido(s.conta?.cpf ?? "");

  async function sair() {
    setSaindo(true);
    try {
      await s.sair();
    } finally {
      setSaindo(false);
      setConfirmarSaida(false);
      // Pilha nova: o "voltar" não volta para dentro da conta que saiu.
      if (router.canDismiss()) router.dismissAll();
      router.replace("/boas-vindas");
    }
  }

  return (
    <Tela voltar={false} rodape={<Abas atual="conta" />}>
      <View style={estilo.topo}>
        <View style={estilo.avatar} accessibilityElementsHidden importantForAccessibility="no">
          <Text style={estilo.iniciais}>{s.conta ? iniciais(s.conta.nome) : ""}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          {s.conta ? (
            <>
              <Titulo style={{ fontSize: 30, lineHeight: 36 }}>{primeiroNome(s.conta.nome)}</Titulo>
              {cpf ? (
                <Text style={estilo.cpf} accessibilityLabel="CPF escondido. só os números do meio aparecem.">
                  CPF {cpf}
                </Text>
              ) : null}
            </>
          ) : (
            <ActivityIndicator color={COR.action} style={{ alignSelf: "flex-start" }} />
          )}
          {s.municipio ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
              <MapPin size={18} color={COR.inkMuted} strokeWidth={2.5} />
              <Pequeno style={{ flex: 1 }}>{nomeMunicipio ?? "seu município"}</Pequeno>
            </View>
          ) : null}
        </View>
      </View>

      <View style={estilo.lista}>
        <Linha
          Icone={MapPin}
          tom="azul"
          rotulo="município"
          descricao={nomeMunicipio ?? "toque para escolher"}
          onPress={() => router.push("/municipio")}
        />
        <Divisor />
        <Linha
          Icone={avisos.ligados ? BellRing : BellOff}
          tom={avisos.ligados ? "verde" : "amarelo"}
          rotulo="avisos"
          descricao={avisos.texto}
          carregando={ligando}
          direita={avisos.ligados ? <Selo texto="ligados" tom="verde" /> : undefined}
          onPress={
            avisos.ligados || !s.avisos
              ? undefined
              : async () => {
                  setLigando(true);
                  try {
                    await s.ligarAvisos();
                  } finally {
                    setLigando(false);
                  }
                }
          }
        />
        <Divisor />
        <Linha
          Icone={Lightbulb}
          tom="amarelo"
          rotulo="como funciona"
          descricao="veja de novo o passo a passo do app"
          onPress={() => router.push({ pathname: "/conhecer", params: { revisao: "1" } })}
        />
        <Divisor />
        <Linha
          Icone={CircleQuestionMark}
          tom="azul"
          rotulo="ajuda"
          descricao="dúvidas comuns e telefones de emergência"
          onPress={() => router.push("/ajuda")}
        />
      </View>

      <View style={estilo.lista}>
        <Linha
          Icone={LogOut}
          tom="vermelho"
          rotulo="sair da conta"
          descricao="para usar outra conta neste celular"
          perigo
          onPress={() => setConfirmarSaida(true)}
        />
      </View>

      <Gaveta aberta={confirmarSaida} fechar={() => setConfirmarSaida(false)} travada={saindo}>
        <Titulo>sair da conta?</Titulo>
        <TextoSuave>você deixa de receber os avisos neste celular.</TextoSuave>
        <Botao texto="sair da conta" tipo="perigoCheio" carregando={saindo} onPress={() => void sair()} />
        <Botao texto="continuar na conta" tipo="secundario" onPress={() => setConfirmarSaida(false)} />
      </Gaveta>
    </Tela>
  );
}

const TONS = {
  azul: { fundo: COR.primary50, cor: COR.action },
  verde: { fundo: COR.successBg, cor: COR.successInk },
  amarelo: { fundo: COR.warningBg, cor: COR.warningInk },
  vermelho: { fundo: COR.dangerBg, cor: COR.dangerInk },
};

function Linha({
  Icone,
  tom,
  rotulo,
  descricao,
  onPress,
  direita,
  carregando = false,
  perigo = false,
}: {
  Icone: LucideIcon;
  tom: keyof typeof TONS;
  rotulo: string;
  descricao: string;
  onPress?: (() => void) | undefined;
  direita?: ReactNode;
  carregando?: boolean;
  perigo?: boolean;
}) {
  const t = TONS[tom];
  const conteudo = (pressed: boolean) => (
    <View style={[estilo.linha, pressed && { backgroundColor: perigo ? COR.dangerBg : COR.primary50 }]}>
      <View style={[estilo.icone, { backgroundColor: t.fundo }]}>
        <Icone size={26} color={t.cor} strokeWidth={2.5} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[estilo.rotulo, perigo && { color: COR.dangerInk }]}>{rotulo}</Text>
        <Text style={estilo.descricao}>{descricao}</Text>
      </View>
      {carregando ? (
        <ActivityIndicator color={COR.action} />
      ) : direita ? (
        direita
      ) : onPress ? (
        <ChevronRight size={26} color={perigo ? COR.dangerInk : COR.inkMuted} strokeWidth={2.5} />
      ) : null}
    </View>
  );
  if (!onPress)
    return (
      <View accessible accessibilityLabel={`${rotulo}: ${descricao}`}>
        {conteudo(false)}
      </View>
    );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      accessibilityHint={descricao}
      accessibilityState={{ busy: carregando }}
      disabled={carregando}
      onPress={onPress}
    >
      {({ pressed }) => conteudo(pressed)}
    </Pressable>
  );
}

const Divisor = () => <View style={{ height: 2, backgroundColor: COR.linha, marginLeft: 76 }} />;

const estilo = StyleSheet.create({
  topo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 18,
    borderRadius: 24,
    backgroundColor: COR.primary50,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COR.action,
    borderBottomWidth: 4,
    borderBottomColor: COR.acaoSombra,
  },
  iniciais: { fontFamily: FONTE.extra, fontSize: 28, color: "#ffffff", letterSpacing: 1 },
  cpf: { fontFamily: FONTE.bold, fontSize: 17, lineHeight: 24, color: COR.inkMuted, letterSpacing: 0.5 },
  lista: {
    borderRadius: 20,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: COR.linha,
    backgroundColor: COR.surface,
    overflow: "hidden",
  },
  linha: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 76,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  icone: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  rotulo: { fontFamily: FONTE.extra, fontSize: 19, lineHeight: 24, color: COR.ink },
  descricao: { fontFamily: FONTE.semi, fontSize: 15, lineHeight: 21, color: COR.inkMuted },
});
