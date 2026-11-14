"use client";

import { mascararCep, soDigitos } from "@fila-saude/schemas/mascaras";
import { unidadeEdicaoSchema, unidadeEntradaSchema } from "@fila-saude/schemas/unidade";
import { PlusIcon } from "lucide-react";
import { type ComponentProps, type FormEvent, useEffect, useMemo, useState } from "react";
import { useConfirmar } from "@/components/dialogos";
import { EditorDeHorario } from "@/components/editor-de-horario";
import { Aviso, Campo, Cartao, Selecao, Tabela, Texto } from "@/components/formulario";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
  { valor: "ubs", rotulo: "UBS" },
  { valor: "policlinica", rotulo: "Policlínica" },
  { valor: "upa", rotulo: "UPA" },
];

function NovaUnidade({ aoCriar }: { aoCriar: (nome: string) => void }) {
  const api = useApi();
  const [v, setV] = useState(VAZIA);
  const [horario, setHorario] = useState<Horario>(HORARIO_PADRAO);
  const fusos = useMemo(() => opcoesDeFuso(), []);
  const [erros, setErros] = useState(SEM_ERROS);
  async function enviar(e: FormEvent) {
    e.preventDefault();
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
    try {
      await api.post("/v1/painel/unidades", corpo);
      setErros(SEM_ERROS);
      setV({ ...VAZIA, tipo: v.tipo, fuso: v.fuso });
      setHorario(HORARIO_PADRAO);
      aoCriar(v.nome);
    } catch (err) {
      setErros(errosDoEnvio(err));
    }
  }

  // Máscara por campo: CEP com traço e CNES só com dígitos, enquanto digita.
  const MASCARA: Partial<Record<keyof typeof VAZIA, (t: string) => string>> = {
    cep: mascararCep,
    cnes: (t) => soDigitos(t).slice(0, 7),
  };
  const campo = (
    k: keyof typeof VAZIA,
    rotulo: string,
    extra: Omit<ComponentProps<typeof Texto>, "valor" | "aoMudar"> = {},
    chaveDoErro: string = k,
  ) => (
    <Campo rotulo={rotulo} erro={erros.campos[chaveDoErro]}>
      <Texto valor={v[k]} mascara={MASCARA[k]} aoMudar={(t) => setV({ ...v, [k]: t })} {...extra} />
    </Campo>
  );

  return (
    <form onSubmit={enviar} className="grid gap-3 sm:grid-cols-2">
      {campo("nome", "Nome", { required: true })}
      <Campo rotulo="Tipo" erro={erros.campos.tipo}>
        <Selecao valor={v.tipo} opcoes={TIPOS} aoMudar={(tipo) => setV({ ...v, tipo })} />
      </Campo>
      {campo("cnes", "Código CNES (opcional)", { inputMode: "numeric", maxLength: 7 })}
      {campo(
        "cep",
        "CEP",
        { inputMode: "numeric", required: true, maxLength: 9, placeholder: "00000-000" },
        "endereco.cep",
      )}
      {campo("logradouro", "Logradouro", { required: true, placeholder: "Rua, avenida…" }, "endereco.logradouro")}
      {campo("numero", "Número", { required: true, placeholder: "ou s/n" }, "endereco.numero")}
      {campo("complemento", "Complemento", {}, "endereco.complemento")}
      {campo("bairro", "Bairro", { required: true }, "endereco.bairro")}
      <Campo rotulo="Fuso horário" erro={erros.campos.fuso}>
        <Selecao
          valor={v.fuso}
          opcoes={fusos.map((f) => ({ valor: f.fuso, rotulo: f.rotulo }))}
          aoMudar={(fuso) => setV({ ...v, fuso })}
        />
      </Campo>
      <div className="flex flex-col gap-2 sm:col-span-2">
        <EditorDeHorario valor={horario} mudar={setHorario} erros={erros.campos} />
        <Aviso texto={erros.geral} />
        <Button type="submit" className="self-start">
          Criar unidade
        </Button>
      </div>
    </form>
  );
}

function HorarioDaUnidade({ unidade, aoSalvar }: { unidade: Unidade; aoSalvar: () => void }) {
  const api = useApi();
  const [horario, setHorario] = useState<Horario>(unidade.horario);
  const [erros, setErros] = useState(SEM_ERROS);
  const [ok, setOk] = useState<string | null>(null);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setOk(null);
    const problemas = problemasDoHorario(horario);
    if (Object.keys(problemas).length > 0) return setErros({ geral: null, campos: problemas });
    const invalidos = validarNoCliente(unidadeEdicaoSchema, { horario });
    if (invalidos) return setErros(invalidos);
    try {
      await api.patch(`/v1/painel/unidades/${unidade.id}`, { horario });
      setErros(SEM_ERROS);
      setOk("Horário salvo.");
      aoSalvar();
    } catch (err) {
      setErros(errosDoEnvio(err));
    }
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-3">
      <EditorDeHorario valor={horario} mudar={setHorario} erros={erros.campos} />
      <Aviso texto={erros.geral} />
      <Aviso texto={ok} tipo="ok" />
      <Button type="submit" variant="outline" className="self-start">
        Salvar horário
      </Button>
    </form>
  );
}

function ConfigDaUnidade({ unidade, aoSalvar }: { unidade: Unidade; aoSalvar: () => void }) {
  const api = useApi();
  const [efetiva, setEfetiva] = useState<ConfigEfetiva | null>(null);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [erros, setErros] = useState(SEM_ERROS);
  const [ok, setOk] = useState<string | null>(null);

  const [erroAoLer, setErroAoLer] = useState<string | null>(null);
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

  if (erroAoLer) return <Aviso texto={erroAoLer} />;
  if (!efetiva) return null;
  const proprios = CAMPOS_CONFIG.map((c) => c.campo).filter((c) => campoHerdado(efetiva, c).proprio);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setOk(null);
    // Só inteiros (ou vazio = herdar): "1,5" ou "dez" viraria NaN no envio.
    const naoInteiros = Object.fromEntries(
      Object.entries(valores)
        .filter(([, t]) => t.trim() !== "" && !/^\d+$/.test(t.trim()))
        .map(([c]) => [`config.${c}`, "Use um número inteiro, ou deixe vazio para herdar."]),
    );
    if (Object.keys(naoInteiros).length > 0) return setErros({ geral: null, campos: naoInteiros });
    const corpo = { config: configParaEnvio(valores, proprios) };
    const invalidos = validarNoCliente(unidadeEdicaoSchema, corpo);
    if (invalidos) return setErros(invalidos);
    try {
      await api.patch(`/v1/painel/unidades/${unidade.id}`, corpo);
      setErros(SEM_ERROS);
      setOk("Configuração salva.");
      setEfetiva(await api.get<ConfigEfetiva>(`/v1/painel/unidades/${unidade.id}/config`));
      aoSalvar();
    } catch (err) {
      setErros(errosDoEnvio(err));
    }
  }

  return (
    <form onSubmit={salvar} className="grid gap-3 sm:grid-cols-2">
      {CAMPOS_CONFIG.map(({ campo, rotulo }) => {
        const h = campoHerdado(efetiva, campo);
        return (
          <Campo
            key={campo}
            rotulo={rotulo}
            erro={erros.campos[`config.${campo}`]}
            dica={valores[campo] ? "valor da unidade (apague para herdar)" : h.texto}
          >
            <Texto
              inputMode="numeric"
              placeholder={String(h.valor)}
              valor={valores[campo] ?? ""}
              aoMudar={(t) => setValores({ ...valores, [campo]: t })}
            />
          </Campo>
        );
      })}
      <div className="flex flex-col gap-2 sm:col-span-2">
        <Aviso texto={erros.geral} />
        <Aviso texto={ok} tipo="ok" />
        <Button type="submit" variant="outline" className="self-start">
          Salvar configuração
        </Button>
      </div>
    </form>
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
    <div className="flex max-w-4xl flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Unidades</h1>
        <Button onClick={() => setCriando(true)}>
          <PlusIcon />
          Adicionar unidade
        </Button>
      </div>
      <Aviso texto={erro ?? aviso} />
      <Aviso texto={ok} tipo="ok" />
      <Tabela cabecalho={["Nome", "Tipo", "CNES", "Endereço", "Horário", ""]}>
        {itens.map((u) => (
          <TableRow key={u.id}>
            <TableCell className="font-medium">{u.nome}</TableCell>
            <TableCell className="uppercase">{u.tipo}</TableCell>
            <TableCell>{u.cnes ?? "—"}</TableCell>
            <TableCell className="whitespace-normal">{enderecoEmTexto(u.endereco)}</TableCell>
            <TableCell className="whitespace-normal">{resumoDoHorario(u.horario)}</TableCell>
            <TableCell className="text-right">
              <Button variant="ghost" size="sm" onClick={() => setAberta(u.id)}>
                Configurar
              </Button>
              <Button variant="ghost" size="sm" onClick={() => remover(u)}>
                Remover
              </Button>
            </TableCell>
          </TableRow>
        ))}
        {itens.length === 0 && !erro ? (
          <TableRow>
            <TableCell colSpan={6} className="py-8 text-center text-gray-500">
              Nenhuma unidade ainda. Use "Adicionar unidade".
            </TableCell>
          </TableRow>
        ) : null}
      </Tabela>
      {/* Configuração ao lado, sem perder a lista de vista. */}
      <Sheet open={selecionada !== null} onOpenChange={(abrir) => !abrir && setAberta(null)}>
        <SheetContent side="right" className="w-full gap-0 sm:max-w-xl">
          {selecionada ? (
            <>
              <SheetHeader className="border-b">
                <SheetTitle>Configurar · {selecionada.nome}</SheetTitle>
                <SheetDescription>{enderecoEmTexto(selecionada.endereco)}</SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-8 overflow-y-auto p-4">
                <section className="flex flex-col gap-3">
                  <h3 className="font-semibold text-gray-900">Horário de funcionamento</h3>
                  <HorarioDaUnidade key={`h-${selecionada.id}`} unidade={selecionada} aoSalvar={recarregar} />
                </section>
                <section className="flex flex-col gap-3">
                  <h3 className="font-semibold text-gray-900">Regras da fila</h3>
                  <ConfigDaUnidade key={`c-${selecionada.id}`} unidade={selecionada} aoSalvar={recarregar} />
                </section>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
      <Sheet open={criando} onOpenChange={setCriando}>
        <SheetContent side="right" className="w-full gap-0 sm:max-w-xl">
          <SheetHeader className="border-b">
            <SheetTitle>Nova unidade</SheetTitle>
            <SheetDescription>
              Endereço, fuso e horário de funcionamento. As regras da fila vêm do município.
            </SheetDescription>
          </SheetHeader>
          <div className="overflow-y-auto p-4">
            <NovaUnidade
              aoCriar={(nome) => {
                setCriando(false);
                setOk(`Unidade ${nome} criada.`);
                recarregar();
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
