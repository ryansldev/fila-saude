import { router } from "expo-router";
import { useState } from "react";
import { Botao, Campo, Espaco, Faixa, Tela, Titulo } from "@/components/ui";
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
      <Campo rotulo="CPF" value={cpf} onChangeText={setCpf} keyboardType="number-pad" placeholder="000.000.000-00" />
      <Campo rotulo="senha" value={senha} onChangeText={setSenha} secureTextEntry />
      {erro ? <Faixa tipo="perigo" titulo={erro} /> : null}
      <Espaco />
      <Botao texto="entrar" onPress={enviar} carregando={enviando} desativado={!cpf || !senha} />
    </Tela>
  );
}
