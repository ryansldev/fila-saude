import { mascararCpf } from "@fila-saude/schemas/mascaras";
import { router } from "expo-router";
import { useState } from "react";
import { Botao, Campo, CampoSenha, Espaco, Faixa, Tela, Titulo } from "@/components/ui";
import { useSessao } from "@/lib/sessao";
import { mensagemDoErro } from "@/lib/textos";

export default function Entrar() {
  const s = useSessao();
  const [cpf, setCpf] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    setEnviando(true);
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
    <Tela>
      <Titulo>entrar</Titulo>
      <Campo
        rotulo="CPF"
        value={cpf}
        onChangeText={(t) => setCpf(mascararCpf(t))}
        keyboardType="number-pad"
        placeholder="000.000.000-00"
        maxLength={14}
        autoComplete="username"
        textContentType="username"
      />
      <CampoSenha rotulo="senha" value={senha} onChangeText={setSenha} autoComplete="current-password" />
      {erro ? <Faixa tipo="perigo" titulo={erro} /> : null}
      <Espaco />
      <Botao texto="entrar" onPress={enviar} carregando={enviando} desativado={!cpf || !senha} />
    </Tela>
  );
}
