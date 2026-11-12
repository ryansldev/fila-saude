import { Link, router } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";
import { Botao, Campo, Erro, e, Tela } from "@/components/ui";
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
    <Tela titulo="Fila Saúde">
      <Text style={e.texto}>Acompanhe sua vez no posto de saúde sem precisar esperar lá.</Text>
      <Campo rotulo="CPF" value={cpf} onChangeText={setCpf} keyboardType="number-pad" autoComplete="off" />
      <Campo rotulo="Senha" value={senha} onChangeText={setSenha} secureTextEntry />
      <Erro texto={erro} />
      <Botao texto="Entrar" onPress={enviar} carregando={enviando} desativado={!cpf || !senha} />
      <Link href="/cadastro" style={[e.texto, { textAlign: "center", color: "#0b7fc0", padding: 8 }]}>
        Ainda não tenho conta
      </Link>
    </Tela>
  );
}
