import { cpfValido } from "@fila-saude/schemas/cpf";
import { mascararCpf } from "@fila-saude/schemas/mascaras";
import { router } from "expo-router";
import { useState } from "react";
import { Botao, Campo, CampoSenha, Faixa, LinkBotao, Tela, TextoSuave, Titulo } from "@/components/ui";
import { useSessao } from "@/lib/sessao";
import { mensagemDoErro } from "@/lib/textos";

export default function Entrar() {
  const s = useSessao();
  const [cpf, setCpf] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [tentou, setTentou] = useState(false);
  const [enviando, setEnviando] = useState(false);
  // CPF errado é apontado no campo, antes de ir ao servidor (e gastar uma tentativa).
  const erroCpf = tentou && !cpfValido(cpf) ? "CPF inválido. confira os números." : undefined;

  async function enviar() {
    setTentou(true);
    if (!cpfValido(cpf) || enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      await s.entrar(cpf, senha);
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
          <Botao texto="entrar" onPress={enviar} carregando={enviando} desativado={!cpf || !senha} />
          <LinkBotao texto="ainda não tenho conta" onPress={() => router.replace("/cadastro")} />
        </>
      }
    >
      <Titulo>entrar</Titulo>
      <TextoSuave>use o CPF e a senha que você criou no cadastro.</TextoSuave>
      <Campo
        rotulo="CPF"
        value={cpf}
        erro={erroCpf}
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
        onChangeText={(t) => {
          setSenha(t);
          setErro(null);
        }}
        autoComplete="current-password"
        onSubmitEditing={() => void enviar()}
        returnKeyType="go"
      />
      {erro ? <Faixa tipo="perigo" titulo={erro} /> : null}
    </Tela>
  );
}
