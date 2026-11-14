"use client";

import { mascararCep, soDigitos } from "@fila-saude/schemas/mascaras";
import { unidadeEdicaoSchema, unidadeEntradaSchema } from "@fila-saude/schemas/unidade";
import { PlusIcon } from "lucide-react";
import { type ComponentProps, useEffect, useMemo, useState } from "react";
import { useConfirmar } from "@/components/dialogos";
import { EditorDeHorario } from "@/components/editor-de-horario";
import { Aviso, Campo, Escolha, Numero, PainelLateral, Secao, Selecao, Tabela, Texto } from "@/components/formulario";
import { AcoesDaLinha, CabecalhoDaPagina } from "@/components/pagina";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { useApi } from "@/lib/api-context";
import { type ErrosDoEnvio, errosDoEnvio, mensagemDoErro, validarNoCliente } from "@/lib/formularios/erros";
import { opcoesDeFuso } from "@/lib/formularios/fusos";
import { HORARIO_PADRAO, type Horario, problemasDoHorario, resumoDoHorario } from "@/lib/formularios/horario";
import { CAMPOS_CONFIG, type ConfigEfetiva, campoHerdado, configParaEnvio } from "@/lib/formularios/unidade";
import { useLista } from "@/lib/use-lista";

type Unidade = {
  id: string;
  nome: string;
  tipo: string;
  cnes: string | null;
  endereco: Endereco;
  fuso: string;
  horario: Horario;
  config: Record<string, unknown>;
};

type Endereco = { cep: string; logradouro: string; numero: string; complemento: string | null; bairro: string };

const VAZIA = {
  nome: "",
  tipo: "ubs",
  cnes: "",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  fuso: "America/Sao_Paulo",
};

function enderecoEmTexto(e: Endereco) {
  const cep = e.cep.replace(/^(\d{5})(\d{3})$/, "$1-$2");
  return `${e.logradouro}, ${e.numero}${e.complemento ? ` (${e.complemento})` : ""} · ${e.bairro} · ${cep}`;
}

const SEM_ERROS: ErrosDoEnvio = { geral: null, campos: {} };
const TIPOS = [
  { valor: "ubs", rotulo: "UBS", descricao: "Atenção básica: consultas, vacinas e acompanhamento." },
  { valor: "policlinica", rotulo: "Policlínica", descricao: "Especialidades e exames, em geral com encaminhamento." },
  { valor: "upa", rotulo: "UPA", descricao: "Urgência e emergência, aberta por mais horas." },
];
const ROTULO_DO_TIPO: Record<string, string> = Object.fromEntries(TIPOS.map((t) => [t.valor, t.rotulo]));

/** Rótulo sem a unidade entre parênteses: ela vai como sufixo do campo. */
const REGRAS: Record<(typeof CAMPOS_CONFIG)[number]["campo"], { rotulo: string; sufixo: string }> = {
  janelaK: { rotulo: "Janela de chamada (K)", sufixo: "pessoas" },
  toleranciaMin: { rotulo: "Tolerância", sufixo: "min" },
  saiaDeCasaMin: { rotulo: 'Aviso "saia de casa"', sufixo: "min" },
  prazoConfirmacaoHoras: { rotulo: "Prazo de confirmação", sufixo: "h" },
};
const comMaiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** Cadastro de unidade num painel lateral: identificação, endereço, fuso e horário. */
function NovaUnidade({
  aberto,
  aoFechar,
  aoCriar,
}: {
  aberto: boolean;
  aoFechar: () => void;
  aoCriar: (nome: string) => void;
}) {
  const api = useApi();
  const [v, setV] = useState(VAZIA);
  const [horario, setHorario] = useState<Horario>(HORARIO_PADRAO);
  const fusos = useMemo(() => opcoesDeFuso(), []);
  const [erros, setErros] = useState(SEM_ERROS);
  const [enviando, setEnviando] = useState(false);
  // Reabriu: sem erros antigos.
  useEffect(() => {
    if (aberto) setErros(SEM_ERROS);
  }, [aberto]);

  async function enviar() {
    const problemas = problemasDoHorario(horario);
    if (Object.keys(problemas).length > 0) return setErros({ geral: null, campos: problemas });
    const corpo = {
      nome: v.nome,
      tipo: v.tipo,
      cnes: v.cnes.trim() || null,
      endereco: {
        cep: v.cep,
        logradouro: v.logradouro,
        numero: v.numero,
        complemento: v.complemento.trim() || null,
        bairro: v.bairro,
      },
      fuso: v.fuso,
      horario,
    };
    const invalidos = validarNoCliente(unidadeEntradaSchema, corpo);
    if (invalidos) return setErros(invalidos);
    setEnviando(true);
    try {
      await api.post("/v1/painel/unidades", corpo);
      setErros(SEM_ERROS);
      setV({ ...VAZIA, tipo: v.tipo, fuso: v.fuso });
      setHorario(HORARIO_PADRAO);
      aoCriar(v.nome);
    } catch (err) {
      setErros(errosDoEnvio(err));
    } finally {
      setEnviando(false);
    }
  }

  // Máscara por campo: CEP com traço e CNES só com dígitos, enquanto digita.
  const MASCARA: Partial<Record<keyof typeof VAZIA, (t: string) => string>> = {
    cep: mascararCep,
    cnes: (t) => soDigitos(t).slice(0, 7),
  };
  const texto = (k: keyof typeof VAZIA, extra: Omit<ComponentProps<typeof Texto>, "valor" | "aoMudar"> = {}) => (
    <Texto valor={v[k]} mascara={MASCARA[k]} aoMudar={(t) => setV({ ...v, [k]: t })} {...extra} />
  );

  return (
    <PainelLateral
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Adicionar unidade"
      descricao="As regras da fila vêm do município; dá para ajustar depois, em Configurar."
      aoEnviar={enviar}
      acao="Criar unidade"
      enviando={enviando}
    >
      <Secao titulo="Identificação" descricao="Como a unidade aparece no app e no painel.">
        <Campo rotulo="Nome" erro={erros.campos.nome}>
          {texto("nome", { required: true, placeholder: "Ex.: UBS Centro" })}
        </Campo>
        <Campo rotulo="Tipo" erro={erros.campos.tipo}>
          <Escolha colunas={3} valor={v.tipo} opcoes={TIPOS} aoMudar={(tipo) => setV({ ...v, tipo })} />
        </Campo>
        <Campo
          rotulo="Código CNES (opcional)"
          erro={erros.campos.cnes}
          dica="7 dígitos, do cadastro nacional de estabelecimentos."
          className="sm:w-60"
        >
          {texto("cnes", { inputMode: "numeric", maxLength: 7, placeholder: "0000000" })}
        </Campo>
      </Secao>
      <Secao titulo="Endereço" descricao="Cidade e estado vêm do município.">
        <div className="grid gap-x-5 gap-y-5 sm:grid-cols-[10rem_1fr]">
          <Campo rotulo="CEP" erro={erros.campos["endereco.cep"]}>
            {texto("cep", { inputMode: "numeric", required: true, maxLength: 9, placeholder: "00000-000" })}
          </Campo>
          <Campo rotulo="Logradouro" erro={erros.campos["endereco.logradouro"]}>
            {texto("logradouro", { required: true, placeholder: "Rua, avenida…" })}
          </Campo>
          <Campo rotulo="Número" erro={erros.campos["endereco.numero"]}>
            {texto("numero", { required: true, placeholder: "ou s/n" })}
          </Campo>
          <Campo rotulo="Complemento" erro={erros.campos["endereco.complemento"]}>
            {texto("complemento", { placeholder: "Opcional" })}
          </Campo>
        </div>
        <Campo rotulo="Bairro" erro={erros.campos["endereco.bairro"]}>
          {texto("bairro", { required: true })}
        </Campo>
      </Secao>
      <Secao titulo="Fuso e horário" descricao="Dias sem intervalo ficam fechados.">
        <Campo rotulo="Fuso horário" erro={erros.campos.fuso} className="sm:w-80">
          <Selecao
            valor={v.fuso}
            opcoes={fusos.map((f) => ({ valor: f.fuso, rotulo: f.rotulo }))}
            aoMudar={(fuso) => setV({ ...v, fuso })}
          />
        </Campo>
        <EditorDeHorario valor={horario} mudar={setHorario} erros={erros.campos} />
      </Secao>
      <Aviso texto={erros.geral} />
    </PainelLateral>
  );
}

/**
 * Horário e regras da fila de uma unidade, num só envio (o PATCH aceita os dois juntos).
 * Regra vazia = herda do município ou do padrão.
 */
function ConfigurarUnidade({
  unidade,
  aoFechar,
  aoSalvar,
}: {
  unidade: Unidade;
  aoFechar: () => void;
  aoSalvar: (nome: string) => void;
}) {
  const api = useApi();
  const [horario, setHorario] = useState<Horario>(unidade.horario);
  const [efetiva, setEfetiva] = useState<ConfigEfetiva | null>(null);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [erros, setErros] = useState(SEM_ERROS);
  const [erroAoLer, setErroAoLer] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let ativo = true;
    api
      .get<ConfigEfetiva>(`/v1/painel/unidades/${unidade.id}/config`)
      .then((c) => {
        if (!ativo) return;
        setEfetiva(c);
        setErroAoLer(null);
        setValores(
          Object.fromEntries(
            CAMPOS_CONFIG.map(({ campo }) => [campo, c.origem[campo] === "unidade" ? String(c.valores[campo]) : ""]),
          ),
        );
      })
      .catch((e) => ativo && setErroAoLer(mensagemDoErro(e)));
    return () => {
      ativo = false;
    };
  }, [api, unidade.id]);

  async function salvar() {
    const problemas = problemasDoHorario(horario);
    if (Object.keys(problemas).length > 0) return setErros({ geral: null, campos: problemas });
    // Só inteiros (ou vazio = herdar): "1,5" ou "dez" viraria NaN no envio.
    const naoInteiros = Object.fromEntries(
      Object.entries(valores)
        .filter(([, t]) => t.trim() !== "" && !/^\d+$/.test(t.trim()))
        .map(([c]) => [`config.${c}`, "Use um número inteiro, ou deixe vazio para herdar."]),
    );
    if (Object.keys(naoInteiros).length > 0) return setErros({ geral: null, campos: naoInteiros });
    // Sem a config lida, só o horário vai (não dá para saber o que é próprio da unidade).
    const proprios = efetiva ? CAMPOS_CONFIG.map((c) => c.campo).filter((c) => campoHerdado(efetiva, c).proprio) : [];
    const config = efetiva ? configParaEnvio(valores, proprios) : {};
    const corpo = Object.keys(config).length > 0 ? { horario, config } : { horario };
    const invalidos = validarNoCliente(unidadeEdicaoSchema, corpo);
    if (invalidos) return setErros(invalidos);
    setEnviando(true);
    try {
      await api.patch(`/v1/painel/unidades/${unidade.id}`, corpo);
      setErros(SEM_ERROS);
      aoSalvar(unidade.nome);
    } catch (err) {
      setErros(errosDoEnvio(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <PainelLateral
      aberto
      aoFechar={aoFechar}
      titulo={`Configurar ${unidade.nome}`}
      descricao={enderecoEmTexto(unidade.endereco)}
      aoEnviar={salvar}
      acao="Salvar"
      enviando={enviando}
    >
      <Secao titulo="Horário de funcionamento" descricao="Dias sem intervalo ficam fechados.">
        <EditorDeHorario valor={horario} mudar={setHorario} erros={erros.campos} />
      </Secao>
      <Secao titulo="Regras da fila" descricao="Deixe vazio para seguir o valor do município ou do padrão.">
        {erroAoLer ? <Aviso texto={erroAoLer} /> : null}
        {efetiva ? (
          <div className="grid gap-x-5 gap-y-5 sm:grid-cols-2">
            {CAMPOS_CONFIG.map(({ campo }) => {
              const h = campoHerdado(efetiva, campo);
              const regra = REGRAS[campo];
              return (
                <Campo
                  key={campo}
                  rotulo={regra.rotulo}
                  erro={erros.campos[`config.${campo}`]}
                  dica={valores[campo] ? "Valor da unidade. Apague para herdar." : `${comMaiuscula(h.texto)}.`}
                >
                  <Numero
                    sufixo={regra.sufixo}
                    placeholder={String(h.valor)}
                    valor={valores[campo] ?? ""}
                    aoMudar={(t) => setValores({ ...valores, [campo]: t })}
                  />
                </Campo>
              );
            })}
          </div>
        ) : null}
      </Secao>
      <Aviso texto={erros.geral} />
    </PainelLateral>
  );
}

export default function Unidades() {
  const api = useApi();
  const { itens, erro, recarregar } = useLista<Unidade>("/v1/painel/unidades");
  const [aberta, setAberta] = useState<string | null>(null);
  const selecionada = itens.find((u) => u.id === aberta) ?? null;
  const [criando, setCriando] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const confirmar = useConfirmar();

  async function remover(u: Unidade) {
    const ok = await confirmar({
      titulo: `Remover a unidade ${u.nome}?`,
      descricao: "A equipe perde o acesso a ela. O histórico fica guardado.",
      acao: "Remover",
      perigo: true,
    });
    if (!ok) return;
    try {
      await api.del(`/v1/painel/unidades/${u.id}`);
      setAviso(null);
      if (aberta === u.id) setAberta(null);
      recarregar();
    } catch (err) {
      setAviso(mensagemDoErro(err));
    }
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <CabecalhoDaPagina
        titulo="Unidades"
        descricao="As unidades de saúde do município, com endereço, horário e regras da fila."
        acoes={
          <Button onClick={() => setCriando(true)}>
            <PlusIcon data-icon="inline-start" strokeWidth={2.75} />
            Adicionar unidade
          </Button>
        }
      />
      <Aviso texto={erro ?? aviso} />
      <Aviso texto={ok} tipo="ok" />
      <Tabela cabecalho={["Nome", "Tipo", "CNES", "Endereço", "Horário", ""]}>
        {itens.map((u) => (
          <TableRow key={u.id}>
            <TableCell className="font-semibold text-slate-900">{u.nome}</TableCell>
            <TableCell>{ROTULO_DO_TIPO[u.tipo] ?? u.tipo}</TableCell>
            <TableCell>{u.cnes ?? "—"}</TableCell>
            <TableCell className="whitespace-normal">{enderecoEmTexto(u.endereco)}</TableCell>
            <TableCell className="whitespace-normal">{resumoDoHorario(u.horario)}</TableCell>
            <TableCell>
              <AcoesDaLinha
                excluir={{ rotulo: `Remover ${u.nome}`, aoClicar: () => remover(u) }}
                editar={{ rotulo: `Configurar ${u.nome}`, aoClicar: () => setAberta(u.id) }}
              />
            </TableCell>
          </TableRow>
        ))}
        {itens.length === 0 && !erro ? (
          <TableRow>
            <TableCell colSpan={6} className="py-8 text-center text-slate-500">
              Nenhuma unidade ainda. Use "Adicionar unidade".
            </TableCell>
          </TableRow>
        ) : null}
      </Tabela>
      {selecionada ? (
        <ConfigurarUnidade
          key={selecionada.id}
          unidade={selecionada}
          aoFechar={() => setAberta(null)}
          aoSalvar={(nome) => {
            setAberta(null);
            setOk(`Unidade ${nome} salva.`);
            recarregar();
          }}
        />
      ) : null}
      <NovaUnidade
        aberto={criando}
        aoFechar={() => setCriando(false)}
        aoCriar={(nome) => {
          setCriando(false);
          setOk(`Unidade ${nome} criada.`);
          recarregar();
        }}
      />
    </div>
  );
}
