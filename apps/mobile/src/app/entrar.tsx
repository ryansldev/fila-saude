import { mascararCpf } from "@fila-saude/schemas/mascaras";
import { router, useLocalSearchParams } from "expo-router";
import { IdCard, KeyRound } from "lucide-react-native";
import { useState } from "react";
import { Text, View } from "react-native";
import {
  BalaoDoLino,
  Botao,
  Campo,
  CampoSenha,
  COR,
  Faixa,
  FalaDoDr,
  FONTE,
  Gaveta,
  Tela,
  TextoSuave,
} from "@/components/ui";
import { useSessao } from "@/lib/sessao";
import { mensagemDoErro } from "@/lib/textos";
import { faltaNoLogin } from "@/lib/validacao";

/** Entrar: o Dr. Lino recebe quem volta; o que falta é dito no próprio campo. */
export default function Entrar() {
  const s = useSessao();
  // Vindo do cadastro com "entrar com este CPF", o CPF já vem preenchido.
  const params = useLocalSearchParams<{ cpf?: string }>();
  const [cpf, setCpf] = useState(params.cpf ? mascararCpf(params.cpf) : "");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [tentou, setTentou] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [esqueci, setEsqueci] = useState(false);
  // CPF errado ou campo vazio é apontado no campo, antes de ir ao servidor (e gastar uma tentativa).
  const falta = tentou ? faltaNoLogin(cpf, senha) : {};

  async function enviar() {
    setTentou(true);
    const f = faltaNoLogin(cpf, senha);
    if (f.cpf || f.senha || enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      await s.entrar(cpf, senha);
      // Pilha nova: o "voltar" não leva de volta ao cadastro, ao login ou ao "conhecer o app".
      if (router.canDismiss()) router.dismissAll();
      router.replace("/");
    } catch (err) {
      setErro(mensagemDoErro(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Tela
      acoes={
        <>
          <Botao texto="entrar" onPress={enviar} carregando={enviando} />
          <Botao variante="texto" texto="ainda não tenho conta" onPress={() => router.replace("/cadastro")} />
        </>
      }
      rodape={
        <Gaveta aberta={esqueci} fechar={() => setEsqueci(false)}>
          <FalaDoDr cumprimento="sem problema" texto="a recepção da sua unidade troca a senha para você." />
          <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
            <IdCard size={24} color={COR.action} strokeWidth={2.3} style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: FONTE.extra, fontSize: 17, lineHeight: 24, color: COR.ink }}>
                leve um documento com foto
              </Text>
              <TextoSuave style={{ fontSize: 16, lineHeight: 22 }}>RG, CNH ou outro com o seu CPF.</TextoSuave>
            </View>
          </View>
          <Botao
            texto="ver as unidades perto de mim"
            onPress={() => {
              setEsqueci(false);
              router.push("/unidades");
            }}
          />
          <Botao variante="texto" texto="voltar para entrar" onPress={() => setEsqueci(false)} />
        </Gaveta>
      }
    >
      <BalaoDoLino texto="que bom te ver de novo! entre com o seu CPF e a senha." />
      <Campo
        rotulo="CPF"
        value={cpf}
        erro={falta.cpf}
        onChangeText={(t) => {
          setCpf(mascararCpf(t));
          setErro(null);
        }}
        keyboardType="number-pad"
        placeholder="000.000.000-00"
        maxLength={14}
        autoComplete="username"
        textContentType="username"
      />
      <CampoSenha
        rotulo="senha"
        value={senha}
        erro={falta.senha}
        onChangeText={(t) => {
          setSenha(t);
          setErro(null);
        }}
        autoComplete="current-password"
        onSubmitEditing={() => void enviar()}
        returnKeyType="go"
      />
      <View style={{ alignItems: "flex-end", marginTop: -8 }}>
        <Botao
          variante="texto"
          tamanho="medio"
          icone={KeyRound}
          texto="esqueci a senha"
          onPress={() => setEsqueci(true)}
        />
      </View>
      {erro ? <Faixa tipo="perigo" titulo={erro} /> : null}
    </Tela>
  );
}
