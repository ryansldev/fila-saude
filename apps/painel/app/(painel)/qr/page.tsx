"use client";

import type { QrDaUnidade } from "@fila-saude/schemas/fila";
import { MonitorIcon } from "lucide-react";
import { Aviso } from "@/components/formulario";
import { CabecalhoDaPagina } from "@/components/pagina";
import { Button } from "@/components/ui/button";
import { Balao, DrLino } from "@/components/ui/dr-lino";
import { QrDeEntrada } from "@/components/ui/qr-de-entrada";
import { useUnidadeAtual } from "@/lib/unidade-atual";
import { useConsulta } from "@/lib/use-consulta";

const PASSOS = [
  {
    titulo: "Deixe o código à vista de quem chega",
    texto: 'Na TV da sala de espera ou num monitor virado para o balcão ("Abrir para o paciente").',
  },
  {
    titulo: "A pessoa lê com o celular",
    texto: 'E passa de "a caminho" para "na unidade" na Fila do dia. Você não precisa fazer nada.',
  },
  { titulo: "O código troca a cada 30 s", texto: "Assim ninguém entra na fila de casa com uma foto dele." },
] as const;

/**
 * QR de entrada, a tela da equipe (RN-PRES-01): o código para conferir, as sessões abertas e o
 * Dr. Lino explicando a quem atende como o QR funciona. O paciente vê a versão em tela cheia.
 */
export default function QrDeEntradaDaEquipe() {
  const { atual, erro: erroDasUnidades } = useUnidadeAtual([
    "conferir_e_marcar_presenca",
    "abrir_cancelar_encerrar_sessao",
  ]);
  const qr = useConsulta<QrDaUnidade>(atual ? `/v1/painel/unidades/${atual}/qr` : null, 5_000);
  const valido = qr.dado?.conteudo && qr.dado.expiraEm && Date.parse(qr.dado.expiraEm) > Date.now() && !qr.erro;

  return (
    <div className="flex w-full flex-col gap-5">
      <CabecalhoDaPagina
        titulo="QR de entrada"
        descricao="Quem já se inscreveu entra na fila de hoje lendo este código ao chegar."
        acoes={
          <Button icone={MonitorIcon} onClick={() => window.open("/qr-paciente", "_blank", "noopener")}>
            Abrir para o paciente (tela cheia)
          </Button>
        }
      />
      <Aviso texto={erroDasUnidades ?? qr.erro} />
      {qr.dado && qr.dado.sessoes.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {qr.dado.sessoes.map((s) => (
            <span
              key={s.id}
              className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--ds-linha)] bg-white px-3 py-1 text-sm font-bold"
            >
              <span className="size-2 rounded-full bg-green-600" aria-hidden />
              {s.servico}
            </span>
          ))}
        </div>
      ) : null}
      <div className="grid items-start gap-4 lg:grid-cols-[260px_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
          {valido && qr.dado?.conteudo ? (
            <>
              <QrDeEntrada
                conteudo={qr.dado.conteudo}
                expiraEm={qr.dado.expiraEm}
                intervaloSegundos={qr.dado.intervaloSegundos}
              />
              <p className="mt-2 text-xs text-slate-500">troca sozinho a cada {qr.dado.intervaloSegundos} s</p>
            </>
          ) : (
            <p className="px-2 py-10 text-sm text-slate-600">O código aparece quando uma sessão abrir.</p>
          )}
        </section>
        <section className="grid grid-cols-[76px_1fr] items-start gap-4 rounded-2xl border border-slate-200 bg-white p-4">
          <DrLino />
          <div className="flex flex-col gap-4">
            <Balao className="text-[15px]">Oi! Eu explico como o QR funciona na sua unidade.</Balao>
            <ol className="flex flex-col gap-3">
              {PASSOS.map((p, i) => (
                <li key={p.titulo} className="grid grid-cols-[28px_1fr] gap-3 text-sm text-slate-600">
                  <span className="flex size-7 items-center justify-center rounded-full bg-primary-50 font-extrabold text-primary">
                    {i + 1}
                  </span>
                  <span>
                    <strong className="block text-slate-900">{p.titulo}</strong>
                    {p.texto}
                  </span>
                </li>
              ))}
              <li className="grid grid-cols-[28px_1fr] gap-3 text-sm text-slate-600">
                <span className="flex size-7 items-center justify-center rounded-full bg-amber-50 font-extrabold text-amber-800">
                  !
                </span>
                <span>
                  <strong className="block text-slate-900">Não deu certo?</strong>
                  Sem celular, câmera que não lê ou "passe na recepção": confira o documento e marque a presença na Fila
                  do dia.
                </span>
              </li>
            </ol>
          </div>
        </section>
      </div>
    </div>
  );
}
