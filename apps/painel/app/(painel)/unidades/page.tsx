"use client";

import { type FormEvent, useEffect, useState } from "react";
import { Aviso, Campo, Cartao, classeDoCampo, Tabela } from "@/components/formulario";
import { Button } from "@/components/ui/button";
import { useApi } from "@/lib/api-context";
import { type ErrosDoEnvio, errosDoEnvio } from "@/lib/formularios/erros";
import { CAMPOS_CONFIG, type ConfigEfetiva, campoHerdado, configParaEnvio } from "@/lib/formularios/unidade";
import { useLista } from "@/lib/use-lista";

type Unidade = {
  id: string;
  nome: string;
  tipo: string;
  cnes: string | null;
  endereco: Endereco;
  lat: number;
  lng: number;
  fuso: string;
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
  lat: "",
  lng: "",
  fuso: "America/Sao_Paulo",
};

function enderecoEmTexto(e: Endereco) {
  const cep = e.cep.replace(/^(\d{5})(\d{3})$/, "$1-$2");
  return `${e.logradouro}, ${e.numero}${e.complemento ? ` (${e.complemento})` : ""} · ${e.bairro} · ${cep}`;
}

const DIAS_UTEIS = Object.fromEntries(["1", "2", "3", "4", "5"].map((d) => [d, [{ abre: "07:00", fecha: "17:00" }]]));
const SEM_ERROS: ErrosDoEnvio = { geral: null, campos: {} };

function NovaUnidade({ aoCriar }: { aoCriar: () => void }) {
  const api = useApi();
  const [v, setV] = useState(VAZIA);
  const [erros, setErros] = useState(SEM_ERROS);
  const [ok, setOk] = useState<string | null>(null);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setOk(null);
    try {
      await api.post("/v1/painel/unidades", {
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
        lat: Number(v.lat),
        lng: Number(v.lng),
        fuso: v.fuso,
        horario: DIAS_UTEIS,
      });
      setErros(SEM_ERROS);
      setOk(`Unidade ${v.nome} criada.`);
      setV({ ...VAZIA, tipo: v.tipo, fuso: v.fuso });
      aoCriar();
    } catch (err) {
      setErros(errosDoEnvio(err));
    }
  }

  const campo = (k: keyof typeof VAZIA, rotulo: string, extra: object = {}, chaveDoErro: string = k) => (
    <Campo rotulo={rotulo} erro={erros.campos[chaveDoErro]}>
      <input className={classeDoCampo} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} {...extra} />
    </Campo>
  );

  return (
    <Cartao titulo="Nova unidade">
      <form onSubmit={enviar} className="grid gap-3 sm:grid-cols-2">
        {campo("nome", "Nome", { required: true })}
        <Campo rotulo="Tipo" erro={erros.campos.tipo}>
          <select className={classeDoCampo} value={v.tipo} onChange={(e) => setV({ ...v, tipo: e.target.value })}>
            <option value="ubs">UBS</option>
            <option value="policlinica">Policlínica</option>
            <option value="upa">UPA</option>
          </select>
        </Campo>
        {campo("cnes", "Código CNES (opcional)", { inputMode: "numeric", maxLength: 7 })}
        {campo("cep", "CEP", { inputMode: "numeric", required: true }, "endereco.cep")}
        {campo("logradouro", "Logradouro", { required: true, placeholder: "Rua, avenida…" }, "endereco.logradouro")}
        {campo("numero", "Número", { required: true, placeholder: "ou s/n" }, "endereco.numero")}
        {campo("complemento", "Complemento", {}, "endereco.complemento")}
        {campo("bairro", "Bairro", { required: true }, "endereco.bairro")}
        {campo("fuso", "Fuso horário")}
        {campo("lat", "Latitude", { inputMode: "decimal", required: true })}
        {campo("lng", "Longitude", { inputMode: "decimal", required: true })}
        <div className="flex flex-col gap-2 sm:col-span-2">
          <p className="text-xs text-gray-500">Horário inicial: segunda a sexta, 07:00 às 17:00.</p>
          <Aviso texto={erros.geral} />
          <Aviso texto={ok} tipo="ok" />
          <Button type="submit" className="self-start">
            Criar unidade
          </Button>
        </div>
      </form>
    </Cartao>
  );
}

function ConfigDaUnidade({ unidade, aoSalvar }: { unidade: Unidade; aoSalvar: () => void }) {
  const api = useApi();
  const [efetiva, setEfetiva] = useState<ConfigEfetiva | null>(null);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [erros, setErros] = useState(SEM_ERROS);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    api.get<ConfigEfetiva>(`/v1/painel/unidades/${unidade.id}/config`).then((c) => {
      setEfetiva(c);
      setValores(
        Object.fromEntries(
          CAMPOS_CONFIG.map(({ campo }) => [campo, c.origem[campo] === "unidade" ? String(c.valores[campo]) : ""]),
        ),
      );
    });
  }, [api, unidade.id]);

  if (!efetiva) return null;
  const proprios = CAMPOS_CONFIG.map((c) => c.campo).filter((c) => campoHerdado(efetiva, c).proprio);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setOk(null);
    try {
      await api.patch(`/v1/painel/unidades/${unidade.id}`, { config: configParaEnvio(valores, proprios) });
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
            <input
              className={classeDoCampo}
              inputMode="numeric"
              placeholder={String(h.valor)}
              value={valores[campo] ?? ""}
              onChange={(e) => setValores({ ...valores, [campo]: e.target.value })}
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
  const { itens, erro, recarregar } = useLista<Unidade>("/v1/painel/unidades");
  const [aberta, setAberta] = useState<string | null>(null);

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <h1 className="text-2xl font-bold text-gray-900">Unidades</h1>
      <Aviso texto={erro} />
      <Tabela cabecalho={["Nome", "Tipo", "CNES", "Endereço", ""]}>
        {itens.map((u) => (
          <tr key={u.id}>
            <td className="py-2 pr-4 font-medium">{u.nome}</td>
            <td className="py-2 pr-4 uppercase">{u.tipo}</td>
            <td className="py-2 pr-4">{u.cnes ?? "—"}</td>
            <td className="py-2 pr-4">{enderecoEmTexto(u.endereco)}</td>
            <td className="py-2">
              <Button variant="ghost" size="sm" onClick={() => setAberta(aberta === u.id ? null : u.id)}>
                {aberta === u.id ? "Fechar" : "Configurar"}
              </Button>
            </td>
          </tr>
        ))}
      </Tabela>
      {itens
        .filter((u) => u.id === aberta)
        .map((u) => (
          <Cartao key={u.id} titulo={`Configuração · ${u.nome}`}>
            <ConfigDaUnidade unidade={u} aoSalvar={recarregar} />
          </Cartao>
        ))}
      <NovaUnidade aoCriar={recarregar} />
    </div>
  );
}
