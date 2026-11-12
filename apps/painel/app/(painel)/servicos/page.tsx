"use client";

import { type FormEvent, useState } from "react";
import { Aviso, Campo, Cartao, classeDoCampo, Tabela } from "@/components/formulario";
import { SeletorDeUnidade } from "@/components/seletor-de-unidade";
import { Button } from "@/components/ui/button";
import { useApi } from "@/lib/api-context";
import { type ErrosDoEnvio, errosDoEnvio } from "@/lib/formularios/erros";
import {
  type Modo,
  mostraTempoTriagem,
  ROTULOS_MODO,
  servicoParaEnvio,
  type ValoresServico,
} from "@/lib/formularios/servico";
import { useUnidadeAtual } from "@/lib/unidade-atual";
import { useLista } from "@/lib/use-lista";

type Servico = {
  id: string;
  nome: string;
  prefixo: string;
  exigeTriagem: boolean;
  modo: Modo;
  tempoMedioMin: { triagem?: number; atendimento?: number };
};

const VAZIO: ValoresServico = {
  nome: "",
  prefixo: "",
  exigeTriagem: false,
  modo: "livre",
  triagem: "5",
  atendimento: "15",
};
const SEM_ERROS: ErrosDoEnvio = { geral: null, campos: {} };

function deServico(s: Servico): ValoresServico {
  return {
    nome: s.nome,
    prefixo: s.prefixo,
    exigeTriagem: s.exigeTriagem,
    modo: s.modo,
    triagem: String(s.tempoMedioMin.triagem ?? ""),
    atendimento: String(s.tempoMedioMin.atendimento ?? ""),
  };
}

function FormularioDeServico({
  inicial,
  enviar,
  rotulo,
  aoCancelar,
}: {
  inicial: ValoresServico;
  enviar: (v: ValoresServico) => Promise<void>;
  rotulo: string;
  aoCancelar?: () => void;
}) {
  const [v, setV] = useState(inicial);
  const [erros, setErros] = useState(SEM_ERROS);

  async function aoEnviar(e: FormEvent) {
    e.preventDefault();
    try {
      await enviar(v);
      setErros(SEM_ERROS);
      if (!aoCancelar) setV(VAZIO);
    } catch (err) {
      setErros(errosDoEnvio(err));
    }
  }

  return (
    <form onSubmit={aoEnviar} className="grid gap-3 sm:grid-cols-2">
      <Campo rotulo="Nome" erro={erros.campos.nome}>
        <input
          className={classeDoCampo}
          required
          value={v.nome}
          onChange={(e) => setV({ ...v, nome: e.target.value })}
        />
      </Campo>
      <Campo rotulo="Prefixo da senha" erro={erros.campos.prefixo} dica="1 a 3 letras (ex.: C → C001)">
        <input
          className={classeDoCampo}
          required
          maxLength={3}
          value={v.prefixo}
          onChange={(e) => setV({ ...v, prefixo: e.target.value.toUpperCase() })}
        />
      </Campo>
      <Campo rotulo="Como é marcado" erro={erros.campos.modo}>
        <select className={classeDoCampo} value={v.modo} onChange={(e) => setV({ ...v, modo: e.target.value as Modo })}>
          {(Object.keys(ROTULOS_MODO) as Modo[]).map((m) => (
            <option key={m} value={m}>
              {ROTULOS_MODO[m]}
            </option>
          ))}
        </select>
      </Campo>
      <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium text-gray-700">
        <input
          type="checkbox"
          checked={v.exigeTriagem}
          onChange={(e) => setV({ ...v, exigeTriagem: e.target.checked })}
        />
        Exige triagem
      </label>
      {mostraTempoTriagem(v.exigeTriagem) ? (
        <Campo rotulo="Tempo médio da triagem (min)" erro={erros.campos["tempoMedioMin.triagem"]}>
          <input
            className={classeDoCampo}
            inputMode="numeric"
            value={v.triagem}
            onChange={(e) => setV({ ...v, triagem: e.target.value })}
          />
        </Campo>
      ) : null}
      <Campo rotulo="Tempo médio do atendimento (min)" erro={erros.campos["tempoMedioMin.atendimento"]}>
        <input
          className={classeDoCampo}
          inputMode="numeric"
          value={v.atendimento}
          onChange={(e) => setV({ ...v, atendimento: e.target.value })}
        />
      </Campo>
      <div className="flex flex-col gap-2 sm:col-span-2">
        <Aviso texto={erros.geral} />
        <div className="flex gap-2">
          <Button type="submit">{rotulo}</Button>
          {aoCancelar ? (
            <Button type="button" variant="ghost" onClick={aoCancelar}>
              Cancelar
            </Button>
          ) : null}
        </div>
      </div>
    </form>
  );
}

export default function Servicos() {
  const api = useApi();
  const { unidades, atual, escolher } = useUnidadeAtual();
  const { itens, erro, recarregar } = useLista<Servico>(atual ? `/v1/painel/unidades/${atual}/servicos` : null);
  const [editando, setEditando] = useState<Servico | null>(null);

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <h1 className="text-2xl font-bold text-gray-900">Serviços</h1>
      <SeletorDeUnidade unidades={unidades} atual={atual} escolher={escolher} />
      <Aviso texto={erro} />
      {atual ? (
        <>
          <Tabela cabecalho={["Prefixo", "Nome", "Triagem", "Marcação", "Tempo médio", ""]}>
            {itens.map((s) => (
              <tr key={s.id}>
                <td className="py-2 pr-4 font-mono font-semibold">{s.prefixo}</td>
                <td className="py-2 pr-4 font-medium">{s.nome}</td>
                <td className="py-2 pr-4">{s.exigeTriagem ? "Sim" : "Não"}</td>
                <td className="py-2 pr-4">{s.modo}</td>
                <td className="py-2 pr-4">
                  {s.tempoMedioMin.triagem ? `${s.tempoMedioMin.triagem} + ` : ""}
                  {s.tempoMedioMin.atendimento} min
                </td>
                <td className="py-2">
                  <Button variant="ghost" size="sm" onClick={() => setEditando(s)}>
                    Editar
                  </Button>
                </td>
              </tr>
            ))}
          </Tabela>
          {editando ? (
            <Cartao titulo={`Editar ${editando.nome}`}>
              <FormularioDeServico
                key={editando.id}
                inicial={deServico(editando)}
                rotulo="Salvar"
                aoCancelar={() => setEditando(null)}
                enviar={async (v) => {
                  await api.patch(`/v1/painel/servicos/${editando.id}`, servicoParaEnvio(v));
                  setEditando(null);
                  recarregar();
                }}
              />
            </Cartao>
          ) : null}
          <Cartao titulo="Novo serviço">
            <FormularioDeServico
              inicial={VAZIO}
              rotulo="Criar serviço"
              enviar={async (v) => {
                await api.post(`/v1/painel/unidades/${atual}/servicos`, servicoParaEnvio(v));
                recarregar();
              }}
            />
          </Cartao>
        </>
      ) : null}
    </div>
  );
}
