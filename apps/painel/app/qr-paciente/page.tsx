"use client";

import type { QrDaUnidade } from "@fila-saude/schemas/fila";
import type { ResumoDeHoje } from "@fila-saude/schemas/unidade";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Logo } from "@/components/logo";
import { Balao, DrLino } from "@/components/ui/dr-lino";
import { QrDeEntrada } from "@/components/ui/qr-de-entrada";
import { falaSemSessao } from "@/lib/qr";
import { useEu } from "@/lib/sessao";
import { useUnidadeAtual } from "@/lib/unidade-atual";
import { useConsulta } from "@/lib/use-consulta";

const PASSOS = ["abra a câmera do celular", "aponte para o código ao lado", "pronto! fique de olho na TV"];

/**
 * QR de entrada, a tela do paciente (tela cheia, no monitor do balcão): o código grande, o Dr. Lino
 * falando com quem chega e os 3 passos. Aberta pela equipe, com a sessão dela; fundo sempre branco.
 */
export default function QrDoPaciente() {
  const router = useRouter();
  const eu = useEu();
  useEffect(() => {
    if (eu.estado === "anonimo") router.replace("/login");
  }, [eu.estado, router]);
  const { atual, unidade } = useUnidadeAtual(["conferir_e_marcar_presenca", "abrir_cancelar_encerrar_sessao"]);
  const qr = useConsulta<QrDaUnidade>(atual ? `/v1/painel/unidades/${atual}/qr` : null, 5_000);
  const hoje = useConsulta<ResumoDeHoje[]>(atual ? "/v1/painel/unidades/hoje" : null, 60_000);
  const valido = qr.dado?.conteudo && qr.dado.expiraEm && Date.parse(qr.dado.expiraEm) > Date.now() && !qr.erro;
  const proxima = hoje.dado?.find((h) => h.unidadeId === atual)?.proximaAbertura ?? null;
  const fala = valido
    ? "chegou? que bom! leia o código com a câmera do celular."
    : falaSemSessao(proxima, unidade?.fuso ?? "America/Sao_Paulo");

  return (
    <main className="relative flex min-h-screen flex-col bg-white px-[5vw] pt-[2.4vw] pb-[4vw] text-[#111313]">
      <header className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-[1.7vw] font-black text-[#0c2e4e]">
          <Logo className="size-[2.2vw] text-primary" />
          fila saúde
        </span>
        {unidade ? (
          <span className="text-right text-[1.35vw] font-extrabold text-[#0c2e4e]">
            {unidade.nome}
            {unidade.endereco ? (
              <span className="block text-[0.8em] font-semibold text-slate-500">
                {unidade.endereco.logradouro}, {unidade.endereco.numero} — {unidade.endereco.bairro}
              </span>
            ) : null}
          </span>
        ) : null}
      </header>
      <div className="grid flex-1 grid-cols-[30%_1fr] items-center gap-x-[4%] pt-[4vw]">
        <div>
          {valido && qr.dado?.conteudo ? (
            <QrDeEntrada
              conteudo={qr.dado.conteudo}
              expiraEm={qr.dado.expiraEm}
              intervaloSegundos={qr.dado.intervaloSegundos}
            />
          ) : null}
        </div>
        <div className="grid grid-cols-[27%_1fr] items-center gap-x-[4%]">
          <DrLino />
          <div className="flex flex-col gap-[2.2vw]">
            <Balao className="text-[2.15vw] leading-tight">{fala}</Balao>
            {valido ? (
              <>
                <ol className="flex flex-col gap-[1.6vw]">
                  {PASSOS.map((p, i) => (
                    <li key={p} className="flex items-center gap-[1vw] text-[1.75vw] font-bold text-[#1f2d36]">
                      <span className="flex size-[2.7vw] shrink-0 items-center justify-center rounded-full border-b-[3px] border-[var(--ds-acao-sombra)] bg-[var(--ds-acao)] text-[0.85em] font-black text-white">
                        {i + 1}
                      </span>
                      {p}
                    </li>
                  ))}
                </ol>
                <div className="flex flex-wrap gap-2">
                  {qr.dado?.sessoes.map((s) => (
                    <span
                      key={s.id}
                      className="rounded-full bg-[#eaf5f9] px-[1vw] py-[0.2vw] text-[1.4vw] font-extrabold text-[#185b9a]"
                    >
                      {s.servico.toLowerCase()}
                    </span>
                  ))}
                </div>
              </>
            ) : null}
            <p className="rounded-[1vw] bg-[#fffae8] px-[1.6vw] py-[1vw] text-[1.45vw] font-bold text-[#66520a]">
              sem celular ou não deu certo? fale com a recepção.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
