import { mascararCpf, mascararData, mascararTelefone } from "@fila-saude/schemas/mascaras";
import { router } from "expo-router";
import { useState } from "react";
import { Botao, Campo, CampoSenha, Espaco, Faixa, Pequeno, Progresso, Tela, Titulo } from "@/components/ui";
import { useSessao } from "@/lib/sessao";
import { mensagemDoErro } from "@/lib/textos";
import { dataIso, erroDoCadastro } from "@/lib/validacao";

const PASSO_1 = ["nome", "cpf", "nascimento", "telefone"] as const;
const PASSO_2 = ["senha", "email"] as const;

export default function Cadastro() {
  const s = useSessao();
  const [passo, setPasso] = useState<1 | 2>(1);
  const [v, setV] = useState({ nome: "", cpf: "", email: "", telefone: "", nascimento: "", senha: "" });
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  // Mostra os erros de um passo só depois de tentar avançar nele.
  const [tentou, setTentou] = useState<{ 1: boolean; 2: boolean }>({ 1: false, 2: false });
  const mudar = (k: keyof typeof v) => (t: string) => setV({ ...v, [k]: t });
  const erros = erroDoCadastro(v);
  const doPasso = (p: 1 | 2) => (k: (typeof PASSO_1)[number] | (typeof PASSO_2)[number]) =>
    tentou[p] ? erros[k] : undefined;
  const passoOk = (campos: readonly string[]) => campos.every((k) => !(k in erros));

  async function enviar() {
    setTentou({ ...tentou, 2: true });
    if (!passoOk(PASSO_2) || enviando) return;
    setEnviando(true);
    try {
      await s.cadastrar({ ...v, email: v.email.trim(), nascimento: dataIso(v.nascimento) });
      router.replace("/");
    } catch (err) {
      setErro(mensagemDoErro(err));
      // Volta ao passo 1 só quando o problema é de um campo dele (ex.: CPF já cadastrado).
      const e = err as { erro?: string };
      if (e.erro === "cpf_em_uso" || e.erro === "cpf_invalido") setPasso(1);
    } finally {
      setEnviando(false);
    }
  }

  if (passo === 1)
    return (
      <Tela>
        <Progresso>criar conta · 1 de 2</Progresso>
        <Titulo>seus dados</Titulo>
        <Campo
          rotulo="nome completo"
          value={v.nome}
          onChangeText={mudar("nome")}
          autoComplete="name"
          erro={doPasso(1)("nome")}
        />
        <Campo
          rotulo="CPF"
          erro={doPasso(1)("cpf")}
          value={v.cpf}
          onChangeText={(t) => mudar("cpf")(mascararCpf(t))}
          keyboardType="number-pad"
          maxLength={14}
          placeholder="000.000.000-00"
        />
        <Pequeno>usamos o CPF para te identificar na unidade. só números.</Pequeno>
        <Campo
          rotulo="data de nascimento"
          erro={doPasso(1)("nascimento")}
          placeholder="dd/mm/aaaa"
          value={v.nascimento}
          onChangeText={(t) => mudar("nascimento")(mascararData(t))}
          keyboardType="number-pad"
          maxLength={10}
          autoComplete="birthdate-full"
        />
        <Campo
          rotulo="celular"
          erro={doPasso(1)("telefone")}
          value={v.telefone}
          onChangeText={(t) => mudar("telefone")(mascararTelefone(t))}
          keyboardType="phone-pad"
          maxLength={15}
          autoComplete="tel"
          textContentType="telephoneNumber"
          placeholder="(00) 00000-0000"
        />
        {erro ? <Faixa tipo="perigo" titulo={erro} /> : null}
        <Espaco />
        <Botao
          texto="continuar"
          onPress={() => {
            setTentou({ ...tentou, 1: true });
            if (!passoOk(PASSO_1)) return;
            setErro(null);
            setPasso(2);
          }}
        />
      </Tela>
    );

  return (
    <Tela aoVoltar={() => setPasso(1)}>
      <Progresso>criar conta · 2 de 2</Progresso>
      <Titulo>crie sua senha</Titulo>
      <CampoSenha
        rotulo="senha"
        erro={doPasso(2)("senha")}
        value={v.senha}
        onChangeText={mudar("senha")}
        placeholder="pelo menos 8 caracteres"
        autoComplete="new-password"
      />
      <Campo
        rotulo="e-mail"
        erro={doPasso(2)("email")}
        value={v.email}
        onChangeText={mudar("email")}
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
        autoCorrect={false}
        autoCapitalize="none"
        placeholder="seu@email.com"
      />
      {erro ? <Faixa tipo="perigo" titulo={erro} /> : null}
      <Pequeno>o e-mail serve para recuperar a senha. se esquecer, a recepção da unidade também ajuda.</Pequeno>
      <Espaco />
      <Botao texto="criar conta" onPress={enviar} carregando={enviando} />
    </Tela>
  );
}
