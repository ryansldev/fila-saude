import { mascararCpf, mascararData, mascararTelefone } from "@fila-saude/schemas/mascaras";
import { router } from "expo-router";
import { useState } from "react";
import { Botao, Campo, CampoSenha, Faixa, LinkBotao, Pequeno, Tela, TextoSuave, Titulo } from "@/components/ui";
import { ErroDaApi } from "@/lib/api";
import { useSessao } from "@/lib/sessao";
import { mensagemDoErro } from "@/lib/textos";
import { dataIso, erroDoCadastro } from "@/lib/validacao";

const PASSO_1 = ["nome", "cpf", "nascimento", "telefone"] as const;
const PASSO_2 = ["senha", "email"] as const;
type CampoDoCadastro = (typeof PASSO_1)[number] | (typeof PASSO_2)[number];

export default function Cadastro() {
  const s = useSessao();
  const [passo, setPasso] = useState<1 | 2>(1);
  const [v, setV] = useState({ nome: "", cpf: "", email: "", telefone: "", nascimento: "", senha: "" });
  const [erro, setErro] = useState<string | null>(null);
  // Recusa do servidor que é de um campo (CPF ou e-mail já com conta): aparece embaixo dele.
  const [erroDoServidor, setErroDoServidor] = useState<Partial<Record<CampoDoCadastro, string>>>({});
  const [enviando, setEnviando] = useState(false);
  // Mostra os erros de um passo só depois de tentar avançar nele.
  const [tentou, setTentou] = useState<{ 1: boolean; 2: boolean }>({ 1: false, 2: false });
  const mudar = (k: CampoDoCadastro) => (t: string) => {
    setV({ ...v, [k]: t });
    if (erroDoServidor[k]) setErroDoServidor({ ...erroDoServidor, [k]: undefined });
    setErro(null);
  };
  const erros = erroDoCadastro(v);
  const doPasso = (p: 1 | 2) => (k: CampoDoCadastro) => erroDoServidor[k] ?? (tentou[p] ? erros[k] : undefined);
  const passoOk = (campos: readonly string[]) => campos.every((k) => !(k in erros));

  function continuar() {
    setTentou({ ...tentou, 1: true });
    if (!passoOk(PASSO_1) || erroDoServidor.cpf) return;
    setErro(null);
    setPasso(2);
  }

  async function enviar() {
    setTentou({ ...tentou, 2: true });
    if (!passoOk(PASSO_2) || enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      await s.cadastrar({ ...v, email: v.email.trim(), nascimento: dataIso(v.nascimento) });
      // Pilha nova: o "voltar" não leva de volta ao cadastro, ao login ou ao "conhecer o app".
      if (router.canDismiss()) router.dismissAll();
      router.replace("/");
    } catch (err) {
      const codigo = err instanceof ErroDaApi ? err.erro : (err as { erro?: string }).erro;
      if (codigo === "cpf_em_uso" || codigo === "cpf_invalido") {
        // Volta ao passo 1 só quando o problema é de um campo dele.
        setErroDoServidor({ cpf: mensagemDoErro(err) });
        setPasso(1);
      } else if (codigo === "email_em_uso") {
        setErroDoServidor({ email: "este e-mail já tem uma conta. use outro ou entre com o CPF." });
      } else setErro(mensagemDoErro(err));
    } finally {
      setEnviando(false);
    }
  }

  if (passo === 1)
    return (
      <Tela
        progresso={{ atual: 1, total: 2 }}
        acoes={
          <>
            <Botao texto="continuar" onPress={continuar} />
            <LinkBotao texto="já tenho conta" onPress={() => router.replace("/entrar")} />
          </>
        }
      >
        <Titulo>seus dados</Titulo>
        <Campo
          rotulo="nome completo"
          value={v.nome}
          onChangeText={mudar("nome")}
          autoComplete="name"
          autoCapitalize="words"
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
        <Pequeno>usamos o CPF para te identificar na unidade.</Pequeno>
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
      </Tela>
    );

  return (
    <Tela
      progresso={{ atual: 2, total: 2 }}
      aoVoltar={() => setPasso(1)}
      acoes={<Botao texto="criar conta" onPress={enviar} carregando={enviando} />}
    >
      <Titulo>crie sua senha</Titulo>
      <TextoSuave>você vai usar o CPF e esta senha para entrar.</TextoSuave>
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
      <Pequeno>o e-mail serve para recuperar a senha. se esquecer, a recepção da unidade também ajuda.</Pequeno>
      {erro ? <Faixa tipo="perigo" titulo={erro} /> : null}
    </Tela>
  );
}
