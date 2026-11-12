import { router } from "expo-router";
import { useState } from "react";
import { Botao, Campo, Erro, Tela } from "@/components/ui";
import { useSessao } from "@/lib/sessao";
import { mensagemDoErro } from "@/lib/textos";

/** "DD/MM/AAAA" → "AAAA-MM-DD" (ou vazio se incompleto). */
const dataIso = (t: string) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t.trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
};

export default function Cadastro() {
  const s = useSessao();
  const [v, setV] = useState({ nome: "", cpf: "", email: "", telefone: "", nascimento: "", senha: "" });
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const mudar = (k: keyof typeof v) => (t: string) => setV({ ...v, [k]: t });

  async function enviar() {
    if (!dataIso(v.nascimento)) {
      setErro("Data de nascimento no formato DD/MM/AAAA.");
      return;
    }
    setEnviando(true);
    try {
      await s.cadastrar({ ...v, nascimento: dataIso(v.nascimento) });
      router.replace("/");
    } catch (err) {
      setErro(mensagemDoErro(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Tela titulo="Criar conta">
      <Campo rotulo="Nome completo" value={v.nome} onChangeText={mudar("nome")} autoComplete="name" />
      <Campo rotulo="CPF" value={v.cpf} onChangeText={mudar("cpf")} keyboardType="number-pad" />
      <Campo
        rotulo="Data de nascimento"
        placeholder="DD/MM/AAAA"
        value={v.nascimento}
        onChangeText={mudar("nascimento")}
        keyboardType="number-pad"
      />
      <Campo rotulo="Celular" value={v.telefone} onChangeText={mudar("telefone")} keyboardType="phone-pad" />
      <Campo
        rotulo="E-mail"
        value={v.email}
        onChangeText={mudar("email")}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <Campo rotulo="Senha (mínimo 8)" value={v.senha} onChangeText={mudar("senha")} secureTextEntry />
      <Erro texto={erro} />
      <Botao texto="Criar conta" onPress={enviar} carregando={enviando} />
    </Tela>
  );
}
