import { router } from "expo-router";
import { useState } from "react";
import { Botao, Campo, Espaco, Faixa, Pequeno, Progresso, Tela, Titulo } from "@/components/ui";
import { useSessao } from "@/lib/sessao";
import { mensagemDoErro } from "@/lib/textos";

/** "DD/MM/AAAA" → "AAAA-MM-DD" (ou vazio se incompleto). */
const dataIso = (t: string) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t.trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
};

export default function Cadastro() {
  const s = useSessao();
  const [passo, setPasso] = useState<1 | 2>(1);
  const [v, setV] = useState({ nome: "", cpf: "", email: "", telefone: "", nascimento: "", senha: "" });
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const mudar = (k: keyof typeof v) => (t: string) => setV({ ...v, [k]: t });

  async function enviar() {
    setEnviando(true);
    try {
      await s.cadastrar({ ...v, nascimento: dataIso(v.nascimento) });
      router.replace("/");
    } catch (err) {
      setErro(mensagemDoErro(err));
      setPasso(1);
    } finally {
      setEnviando(false);
    }
  }

  if (passo === 1)
    return (
      <Tela>
        <Progresso>criar conta · 1 de 2</Progresso>
        <Titulo>seus dados</Titulo>
        <Campo rotulo="nome completo" value={v.nome} onChangeText={mudar("nome")} autoComplete="name" />
        <Campo
          rotulo="CPF"
          value={v.cpf}
          onChangeText={mudar("cpf")}
          keyboardType="number-pad"
          placeholder="000.000.000-00"
        />
        <Pequeno>usamos o CPF para te identificar na unidade. só números.</Pequeno>
        <Campo
          rotulo="data de nascimento"
          placeholder="dd/mm/aaaa"
          value={v.nascimento}
          onChangeText={mudar("nascimento")}
          keyboardType="number-pad"
        />
        <Campo
          rotulo="celular"
          value={v.telefone}
          onChangeText={mudar("telefone")}
          keyboardType="phone-pad"
          placeholder="(00) 00000-0000"
        />
        {erro ? <Faixa tipo="perigo" titulo={erro} /> : null}
        <Espaco />
        <Botao
          texto="continuar"
          desativado={
            v.nome.trim().length < 3 || v.cpf.replace(/\D/g, "").length !== 11 || !dataIso(v.nascimento) || !v.telefone
          }
          onPress={() => {
            setErro(null);
            setPasso(2);
          }}
        />
      </Tela>
    );

  return (
    <Tela>
      <Progresso>criar conta · 2 de 2</Progresso>
      <Titulo>crie sua senha</Titulo>
      <Campo
        rotulo="senha"
        value={v.senha}
        onChangeText={mudar("senha")}
        secureTextEntry
        placeholder="pelo menos 8 caracteres"
      />
      <Campo
        rotulo="e-mail"
        value={v.email}
        onChangeText={mudar("email")}
        keyboardType="email-address"
        autoCapitalize="none"
        placeholder="seu@email.com"
      />
      <Pequeno>o e-mail serve para recuperar a senha. se esquecer, a recepção da unidade também ajuda.</Pequeno>
      <Espaco />
      <Botao
        texto="criar conta"
        onPress={enviar}
        carregando={enviando}
        desativado={v.senha.length < 8 || !v.email.includes("@")}
      />
    </Tela>
  );
}
