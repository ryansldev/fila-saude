"use client";

import type { QrDaUnidade } from "@fila-saude/schemas/fila";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { Aviso } from "@/components/formulario";
import { SeletorDeUnidade } from "@/components/seletor-de-unidade";
import { useUnidadeAtual } from "@/lib/unidade-atual";
import { useConsulta } from "@/lib/use-consulta";

/**
 * RN-PRES-01: QR de entrada da unidade, para o monitor da recepção até a TV pareada (fatia 2).
 * O código muda a cada 30 s; a tela busca de novo a cada 5 s para nunca mostrar um vencido.
 */
export default function QrDeEntrada() {
  const {
    unidades,
    atual,
    escolher,
    unidade,
    erro: erroDasUnidades,
  } = useUnidadeAtual(["conferir_e_marcar_presenca", "abrir_cancelar_encerrar_sessao"]);
  const qr = useConsulta<QrDaUnidade>(atual ? `/v1/painel/unidades/${atual}/qr` : null, 5_000);
  const [svg, setSvg] = useState<string | null>(null);
  // Sem conexão ou vencido: some da tela (um QR velho não deixa ninguém entrar e confunde).
  const expira = qr.dado?.expiraEm ? Date.parse(qr.dado.expiraEm) : 0;
  const conteudo = !qr.erro && expira > Date.now() ? (qr.dado?.conteudo ?? null) : null;

  useEffect(() => {
    if (!conteudo) {
      setSvg(null);
      return;
    }
    let ativo = true;
    QRCode.toString(conteudo, { type: "svg", margin: 1, errorCorrectionLevel: "M" }).then((s) => ativo && setSvg(s));
    return () => {
      ativo = false;
    };
  }, [conteudo]);

  return (
    <div className="flex w-full flex-col gap-6">
      <h1 className="text-2xl font-bold text-gray-900">QR de entrada</h1>
      <SeletorDeUnidade unidades={unidades} atual={atual} escolher={escolher} erro={erroDasUnidades} />
      <Aviso texto={qr.erro} />
      {qr.dado && !conteudo ? (
        <p className="text-gray-600">Nenhuma sessão aberta agora. O QR aparece quando uma sessão abrir.</p>
      ) : null}
      {svg ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-gray-200 bg-white p-8">
          <p className="text-xl font-semibold text-gray-900">Chegou? Aponte a câmera do celular</p>
          {/* biome-ignore lint/security/noDangerouslySetInnerHtml: SVG gerado localmente pela biblioteca do QR. */}
          <div className="w-80 max-w-full" dangerouslySetInnerHTML={{ __html: svg }} />
          <p className="text-gray-600">
            {unidade?.nome} · {qr.dado?.sessoes.map((s) => s.servico).join(", ")}
          </p>
          <p className="text-sm text-gray-500">O código muda a cada {qr.dado?.intervaloSegundos} s.</p>
        </div>
      ) : null}
    </div>
  );
}
