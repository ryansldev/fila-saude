"use client";

import { pareamentoEntradaSchema, type TvDaUnidade } from "@fila-saude/schemas/tv";
import { PlusIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useConfirmar } from "@/components/dialogos";
import { Aviso, Campo, PainelLateral, Secao, Tabela, Texto } from "@/components/formulario";
import { AcoesDaLinha, CabecalhoDaPagina } from "@/components/pagina";
import { SeletorDeUnidade } from "@/components/seletor-de-unidade";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { useApi } from "@/lib/api-context";
import { type ErrosDoEnvio, errosDoEnvio, mensagemDoErro, validarNoCliente } from "@/lib/formularios/erros";
import { useUnidadeAtual } from "@/lib/unidade-atual";
import { useConsulta } from "@/lib/use-consulta";

const SEM_ERROS: ErrosDoEnvio = { geral: null, campos: {} };

const quando = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "nunca";

/** Situação da TV como selo: verde quando mandou sinal há pouco. */
function Situacao({ online }: { online: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${
        online ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
      }`}
    >
      <span aria-hidden className={`size-1.5 rounded-full ${online ? "bg-emerald-500" : "bg-slate-400"}`} />
      {online ? "Online" : "Offline"}
    </span>
  );
}

/** RN-TV-01 / RN-TV-06: parear pelo código que a TV mostra em `/tv`, ver se está online e revogar. */
export default function Tvs() {
  const api = useApi();
  const confirmar = useConfirmar();
  const {
    unidades,
    atual,
    escolher,
    unidade,
    erro: erroDasUnidades,
  } = useUnidadeAtual(["configurar_servicos_sessoes_estacoes_tv"]);
  const tvs = useConsulta<TvDaUnidade[]>(atual ? `/v1/painel/unidades/${atual}/tvs` : null, 15_000);
  const [pareando, setPareando] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [aviso, setAviso] = useState<{ texto: string; tipo: "erro" | "ok" } | null>(null);
  const [erros, setErros] = useState<ErrosDoEnvio>(SEM_ERROS);
  const [enviando, setEnviando] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: limpa o aviso só ao trocar de unidade.
  useEffect(() => setAviso(null), [atual]);

  function abrirPareamento() {
    setCodigo("");
    setErros(SEM_ERROS);
    setPareando(true);
  }

  async function parear() {
    if (!atual) return;
    const corpo = { codigo: codigo.trim() };
    const invalidos = validarNoCliente(pareamentoEntradaSchema, corpo);
    setErros(invalidos ?? SEM_ERROS);
    if (invalidos) return;
    setEnviando(true);
    try {
      await api.post(`/v1/painel/unidades/${atual}/tvs`, corpo);
      setCodigo("");
      setPareando(false);
      setAviso({ texto: "TV pareada. Ela já mostra a fila da unidade.", tipo: "ok" });
      tvs.recarregar();
    } catch (err) {
      const e = errosDoEnvio(err);
      setErros(e.geral || Object.keys(e.campos).length > 0 ? e : { geral: mensagemDoErro(err), campos: {} });
    } finally {
      setEnviando(false);
    }
  }

  async function revogar(id: string) {
    const ok = await confirmar({
      titulo: "Revogar esta TV?",
      descricao: "Ela volta para a tela de pareamento.",
      acao: "Revogar",
      perigo: true,
    });
    if (!ok) return;
    try {
      await api.del(`/v1/painel/tvs/${id}`);
      tvs.recarregar();
    } catch (err) {
      setAviso({ texto: mensagemDoErro(err), tipo: "erro" });
    }
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <CabecalhoDaPagina
        titulo="TVs da sala de espera"
        descricao="As TVs mostram as senhas chamadas e o QR de entrada. Pareie pelo código que aparece na tela."
        acoes={
          atual ? (
            <Button onClick={abrirPareamento}>
              <PlusIcon data-icon="inline-start" strokeWidth={2.75} />
              Parear TV
            </Button>
          ) : null
        }
      />
      <SeletorDeUnidade unidades={unidades} atual={atual} escolher={escolher} erro={erroDasUnidades} />
      {aviso ? <Aviso texto={aviso.texto} tipo={aviso.tipo} /> : null}
      <Aviso texto={tvs.erro} />
      {atual && tvs.dado ? (
        <Tabela cabecalho={["Pareada em", "Último sinal", "Situação", ""]}>
          {tvs.dado.map((t) => (
            <TableRow key={t.id}>
              <TableCell>{quando(t.pareadaEm)}</TableCell>
              <TableCell>{quando(t.ultimoSinalEm)}</TableCell>
              <TableCell>
                <Situacao online={t.online} />
              </TableCell>
              <TableCell>
                <AcoesDaLinha excluir={{ rotulo: "Revogar TV", aoClicar: () => revogar(t.id) }} />
              </TableCell>
            </TableRow>
          ))}
          {tvs.dado.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="py-8 text-center text-slate-500">
                Nenhuma TV pareada nesta unidade. Use "Parear TV".
              </TableCell>
            </TableRow>
          ) : null}
        </Tabela>
      ) : null}
      <PainelLateral
        aberto={pareando}
        aoFechar={() => setPareando(false)}
        titulo="Parear TV"
        descricao={`A TV passa a mostrar a fila de ${unidade?.nome ?? "esta unidade"}.`}
        aoEnviar={parear}
        acao="Parear"
        enviando={enviando || codigo.length !== 6}
      >
        <Secao
          titulo="Código da TV"
          descricao="Na TV, abra /tv neste mesmo endereço do painel e digite o código de 6 dígitos que aparece."
        >
          <Campo rotulo="Código de 6 dígitos" erro={erros.campos.codigo} className="items-center">
            <Texto
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              placeholder="000000"
              className="h-16 max-w-xs text-center font-mono text-3xl tracking-[0.4em] md:text-3xl"
              valor={codigo}
              aoMudar={setCodigo}
              mascara={(t) => t.replace(/\D/g, "").slice(0, 6)}
            />
          </Campo>
        </Secao>
        <Aviso texto={erros.geral} />
      </PainelLateral>
    </div>
  );
}
