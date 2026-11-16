import { mascararCpf, mascararData, mascararTelefone } from "@fila-saude/schemas/mascaras";
import { router } from "expo-router";
import { Check, Circle } from "lucide-react-native";
import { useState } from "react";
import { type KeyboardTypeOptions, Text, View } from "react-native";
import { BalaoDoLino, Botao, Campo, CampoSenha, Cartao, COR, Faixa, FONTE, Tela } from "@/components/ui";
import { ErroDaApi } from "@/lib/api";
import {
  type DadosDoCadastro,
  erroDoPasso,
  PASSOS_DO_CADASTRO,
  type PassoDoCadastro,
  passoAnterior,
  passoDoErroDoServidor,
  proximoPasso,
  regraDaSenha,
  resumoDoCadastro,
} from "@/lib/cadastro";
import { useSessao } from "@/lib/sessao";
import { mensagemDoErro } from "@/lib/textos";
import { dataIso } from "@/lib/validacao";

type Pergunta = {
  fala: string;
  rotulo: string;
  dica?: string;
  mascara?: (t: string) => string;
  teclado?: KeyboardTypeOptions;
  max?: number;
  exemplo?: string;
  extra?: Partial<React.ComponentProps<typeof Campo>>;
};

const PERGUNTAS: Record<Exclude<PassoDoCadastro, "confira" | "senha">, Pergunta> = {
  nome: {
    fala: "oi! vamos criar a sua conta. qual é o seu nome completo?",
    rotulo: "nome completo",
    extra: { autoComplete: "name", autoCapitalize: "words" },
  },
  cpf: {
    fala: "e o seu CPF?",
    rotulo: "CPF",
    dica: "só para te identificar na unidade.",
    mascara: mascararCpf,
    teclado: "number-pad",
    max: 14,
    exemplo: "000.000.000-00",
  },
  nascimento: {
    fala: "quando você nasceu?",
    rotulo: "data de nascimento",
    mascara: mascararData,
    teclado: "number-pad",
    max: 10,
    exemplo: "dd/mm/aaaa",
    extra: { autoComplete: "birthdate-full" },
  },
  telefone: {
    fala: "qual é o seu celular?",
    rotulo: "celular",
    dica: "com DDD. a unidade usa se precisar falar com você.",
    mascara: mascararTelefone,
    teclado: "phone-pad",
    max: 15,
    exemplo: "(00) 00000-0000",
    extra: { autoComplete: "tel", textContentType: "telephoneNumber" },
  },
  email: {
    fala: "e o seu e-mail?",
    rotulo: "e-mail",
    dica: "para avisos da sua conta.",
    teclado: "email-address",
    exemplo: "seu@email.com",
    extra: { autoComplete: "email", textContentType: "emailAddress", autoCorrect: false, autoCapitalize: "none" },
  },
};

/** Criar conta: o Dr. Lino pergunta uma coisa por tela; no fim, confira e crie. */
export default function Cadastro() {
  const s = useSessao();
  const [passo, setPasso] = useState<PassoDoCadastro>("nome");
  const [corrigindo, setCorrigindo] = useState(false);
  const [v, setV] = useState<DadosDoCadastro>({
    nome: "",
    cpf: "",
    email: "",
    telefone: "",
    nascimento: "",
    senha: "",
  });
  const [tentou, setTentou] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Recusa do servidor que é de um campo (CPF ou e-mail já com conta): aparece embaixo dele.
  const [erroDoServidor, setErroDoServidor] = useState<{
    passo: "cpf" | "email";
    texto: string;
    codigo: string;
  } | null>(null);
  const [enviando, setEnviando] = useState(false);

  const ir = (p: PassoDoCadastro) => {
    setPasso(p);
    setTentou(false);
    setErro(null);
  };
  const sair = () => (router.canGoBack() ? router.back() : router.replace("/boas-vindas"));
  const voltar = () => {
    const anterior = corrigindo ? "confira" : passoAnterior(passo);
    if (anterior === null) sair();
    else {
      if (anterior === "confira") setCorrigindo(false);
      ir(anterior);
    }
  };
  const mudar = (k: keyof DadosDoCadastro) => (t: string) => {
    setV({ ...v, [k]: t });
    if (erroDoServidor?.passo === k) setErroDoServidor(null);
  };
  const erroDaTela =
    erroDoServidor?.passo === passo ? erroDoServidor.texto : tentou ? erroDoPasso(passo, v) : undefined;

  function continuar() {
    setTentou(true);
    if (erroDoPasso(passo, v) || erroDoServidor?.passo === passo) return;
    const proximo = proximoPasso(passo, corrigindo);
    if (proximo === "confira") setCorrigindo(false);
    ir(proximo);
  }

  async function criar() {
    if (enviando) return;
    // Algo inválido (não deveria chegar aqui): volta à primeira tela com erro.
    const comErro = PASSOS_DO_CADASTRO.find((p) => erroDoPasso(p, v));
    if (comErro) {
      ir(comErro);
      setTentou(true);
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      await s.cadastrar({ ...v, email: v.email.trim(), nascimento: dataIso(v.nascimento) });
      // Pilha nova: o "voltar" não leva de volta ao cadastro, ao login ou ao "conhecer o app".
      if (router.canDismiss()) router.dismissAll();
      router.replace("/");
    } catch (err) {
      const codigo = (err instanceof ErroDaApi ? err.erro : (err as { erro?: string }).erro) ?? "";
      const destino = passoDoErroDoServidor(codigo);
      if (destino) {
        setErroDoServidor({
          passo: destino,
          codigo,
          texto:
            codigo === "email_em_uso"
              ? "este e-mail já tem uma conta. use outro ou entre com o CPF."
              : mensagemDoErro(err),
        });
        setCorrigindo(true);
        ir(destino);
      } else setErro(mensagemDoErro(err));
    } finally {
      setEnviando(false);
    }
  }

  const progresso = { atual: PASSOS_DO_CADASTRO.indexOf(passo) + 1, total: PASSOS_DO_CADASTRO.length };

  if (passo === "confira")
    return (
      <Tela
        progresso={progresso}
        aoVoltar={voltar}
        aoFechar={sair}
        acoes={<Botao texto="criar conta" onPress={criar} carregando={enviando} />}
      >
        <BalaoDoLino texto="confira os seus dados." />
        <Cartao style={{ gap: 0, paddingVertical: 6 }}>
          {resumoDoCadastro(v).map((l, i) => (
            <View
              key={l.passo}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                paddingVertical: 8,
                borderTopWidth: i === 0 ? 0 : 1,
                borderColor: COR.linha,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: FONTE.bold, fontSize: 14, color: COR.inkMuted }}>{l.rotulo}</Text>
                <Text style={{ fontFamily: FONTE.extra, fontSize: 18, lineHeight: 24, color: COR.ink }}>{l.valor}</Text>
              </View>
              <Botao
                variante="texto"
                tamanho="medio"
                texto="corrigir"
                onPress={() => {
                  setCorrigindo(true);
                  ir(l.passo);
                }}
              />
            </View>
          ))}
        </Cartao>
        {erro ? <Faixa tipo="perigo" titulo={erro} /> : null}
      </Tela>
    );

  const acoes = (
    <>
      <Botao texto="continuar" onPress={continuar} />
      {passo === "nome" && !corrigindo ? (
        <Botao variante="texto" texto="já tenho conta" onPress={() => router.replace("/entrar")} />
      ) : null}
      {erroDoServidor?.passo === "cpf" && passo === "cpf" && erroDoServidor.codigo === "cpf_em_uso" ? (
        <Botao
          variante="secundario"
          texto="entrar com este CPF"
          onPress={() => router.replace({ pathname: "/entrar", params: { cpf: v.cpf } })}
        />
      ) : null}
    </>
  );

  if (passo === "senha") {
    const regra = regraDaSenha(v.senha);
    const Marca = regra.oitoCaracteres ? Check : Circle;
    return (
      <Tela progresso={progresso} aoVoltar={voltar} aoFechar={sair} acoes={acoes}>
        <BalaoDoLino texto="crie uma senha para entrar no app." />
        <CampoSenha
          key="senha"
          rotulo="senha"
          erro={erroDaTela}
          value={v.senha}
          onChangeText={mudar("senha")}
          autoComplete="new-password"
          autoFocus
          onSubmitEditing={continuar}
        />
        <View
          accessibilityLabel={`pelo menos 8 caracteres${regra.oitoCaracteres ? ", ok" : ""}`}
          style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
        >
          <Marca size={18} color={regra.oitoCaracteres ? COR.successInk : "#9aa3a5"} strokeWidth={2.6} />
          <Text
            style={{
              fontFamily: FONTE.bold,
              fontSize: 16,
              color: regra.oitoCaracteres ? COR.successInk : COR.inkMuted,
            }}
          >
            pelo menos 8 caracteres
          </Text>
        </View>
      </Tela>
    );
  }

  const q = PERGUNTAS[passo];
  const valor = v[passo];
  return (
    <Tela progresso={progresso} aoVoltar={voltar} aoFechar={sair} acoes={acoes}>
      <BalaoDoLino texto={q.fala} />
      <Campo
        key={passo}
        rotulo={q.rotulo}
        dica={q.dica}
        erro={erroDaTela}
        value={valor}
        onChangeText={(t) => mudar(passo)(q.mascara ? q.mascara(t) : t)}
        keyboardType={q.teclado}
        maxLength={q.max}
        placeholder={q.exemplo}
        autoFocus
        returnKeyType="next"
        onSubmitEditing={continuar}
        {...q.extra}
      />
    </Tela>
  );
}
