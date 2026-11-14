"use client";

import type { TvEstado, TvRegistro } from "@fila-saude/schemas/tv";
import QRCode from "qrcode";
import { useCallback, useEffect, useRef, useState } from "react";
import { Logo } from "@/components/logo";
import { urlDaApi } from "@/lib/tenant";
import { ANUNCIOS_VAZIOS, type Anuncios, avancarAnuncios, receberChamadas, ultimasAnunciadas } from "@/lib/tv";

const CHAVE = "fila-saude:tv";
const CONSULTA_MS = 2_000; // PD-48
const OFFLINE_APOS = 3; // leituras seguidas sem resposta: aviso discreto
const OFFLINE_LONGO = 30; // ~1 min sem resposta: tela de "reconectando"

const lerToken = () => {
  try {
    return window.localStorage.getItem(CHAVE);
  } catch {
    return null;
  }
};
const gravarToken = (t: string | null) => {
  try {
    if (t) window.localStorage.setItem(CHAVE, t);
    else window.localStorage.removeItem(CHAVE);
  } catch {}
};

/** RN-TV-04: dois tons gerados no navegador, sem voz. */
function tocarAviso(ctx: AudioContext | null) {
  if (!ctx) return;
  const tom = (freq: number, inicio: number) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, ctx.currentTime + inicio);
    g.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + inicio + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + inicio + 0.45);
    o.connect(g).connect(ctx.destination);
    o.start(ctx.currentTime + inicio);
    o.stop(ctx.currentTime + inicio + 0.5);
  };
  tom(880, 0);
  tom(660, 0.5);
}

function useSvgDoQr(conteudo: string | null) {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    if (!conteudo) return setSvg(null);
    let ativo = true;
    QRCode.toString(conteudo, { type: "svg", margin: 1, errorCorrectionLevel: "M" }).then((s) => ativo && setSvg(s));
    return () => {
      ativo = false;
    };
  }, [conteudo]);
  return svg;
}

/** T3.5: TV da sala de espera. Pareamento (RN-TV-01), só senhas (RN-TV-05), fila de anúncios (RN-TV-07). */
export default function Tv() {
  const [estado, setEstado] = useState<TvEstado | null>(null);
  const [falhas, setFalhas] = useState(0);
  const [iniciado, setIniciado] = useState(false);
  const [anuncios, setAnuncios] = useState<Anuncios>(ANUNCIOS_VAZIOS);
  const audio = useRef<AudioContext | null>(null);
  const pareada = estado?.estado === "pareada" ? estado : null;
  const svg = useSvgDoQr(pareada?.qr?.conteudo ?? null);

  const base = useCallback(
    () => urlDaApi(window.location, { NEXT_PUBLIC_API_PORTA: process.env.NEXT_PUBLIC_API_PORTA }),
    [],
  );

  useEffect(() => {
    let ativo = true;
    const registrar = async () => {
      const r = await fetch(`${base()}/v1/tv`, { method: "POST" });
      if (!r.ok) throw new Error("registro");
      const dados = (await r.json()) as TvRegistro;
      gravarToken(dados.token);
      return dados.token;
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Uma consulta por vez: a próxima só sai depois da resposta (senão duas leituras sem token
    // registravam duas TVs e o código piscava).
    const buscar = async () => {
      try {
        const token = lerToken() ?? (await registrar());
        const r = await fetch(`${base()}/v1/tv/tela`, { headers: { authorization: `Bearer ${token}` } });
        // RN-TV-01: revogada, desconhecida ou código vencido (o servidor decide): volta ao pareamento.
        if (r.status === 401) gravarToken(null);
        else {
          if (!r.ok) throw new Error(String(r.status));
          const dados = (await r.json()) as TvEstado;
          if (!ativo) return;
          setEstado(dados);
          setFalhas(0);
          if (dados.estado === "pareada") {
            const maxAtraso = dados.destaqueSegundos * 2000;
            setAnuncios((a) => receberChamadas(a, dados.chamadas, Date.now(), maxAtraso));
          }
        }
      } catch {
        if (ativo) setFalhas((f) => f + 1);
      }
      if (ativo) timer = setTimeout(buscar, CONSULTA_MS);
    };
    void buscar();
    return () => {
      ativo = false;
      if (timer) clearTimeout(timer);
    };
  }, [base]);

  const destaqueMs = (pareada?.destaqueSegundos ?? 10) * 1000;
  useEffect(() => {
    const id = setInterval(() => setAnuncios((a) => avancarAnuncios(a, Date.now(), destaqueMs).estado), 250);
    return () => clearInterval(id);
  }, [destaqueMs]);

  // RN-TV-04: o som toca uma vez por anúncio, fora do atualizador de estado (que o React pode repetir).
  const anunciando = anuncios.atual?.chamada.id ?? null;
  useEffect(() => {
    if (anunciando) tocarAviso(audio.current);
  }, [anunciando]);

  // RN-TV-06: queda curta mantém a última tela com um aviso; só uma queda longa troca a tela.
  const semConexao = falhas >= OFFLINE_APOS;
  const offline = falhas >= OFFLINE_LONGO || (semConexao && estado?.estado !== "pareada");

  return (
    <main className="flex min-h-screen flex-col bg-primary-900 font-[family-name:var(--font-nunito)] text-white">
      {offline ? (
        <Centro>
          <p className="text-5xl font-extrabold">reconectando…</p>
          <p className="text-2xl opacity-80">a fila volta a aparecer quando a internet voltar.</p>
        </Centro>
      ) : !estado ? (
        <Centro>
          <Logo className="size-24 text-white" />
        </Centro>
      ) : estado.estado === "aguardando" ? (
        <Centro>
          <Logo className="size-20 text-white" />
          <p className="text-3xl">para ligar esta TV, digite no painel da unidade o código</p>
          <p className="font-mono text-[10rem] leading-none font-extrabold tracking-[0.2em]">{estado.codigo}</p>
          <p className="text-xl opacity-70">unidades › TVs › parear TV</p>
        </Centro>
      ) : !iniciado ? (
        <Centro>
          <Logo className="size-20 text-white" />
          <p className="text-4xl font-bold">{estado.unidade.nome}</p>
          <button
            type="button"
            className="rounded-2xl bg-white px-12 py-6 text-4xl font-extrabold text-primary-900"
            onClick={() => {
              // RN-TV-04: o navegador só libera o som depois de um toque.
              audio.current = new AudioContext();
              setIniciado(true);
            }}
          >
            iniciar painel
          </button>
          <p className="text-xl opacity-70">toque uma vez para ligar o som das chamadas.</p>
        </Centro>
      ) : (
        <>
          <Painel
            estado={estado}
            atual={anuncios.atual?.chamada ?? null}
            ultimas={ultimasAnunciadas(anuncios, estado.chamadas).slice(0, 4)}
            svg={semConexao ? null : svg}
          />
          {semConexao ? (
            <p className="fixed right-6 bottom-4 rounded-full bg-white/20 px-4 py-2 text-xl">
              sem conexão · reconectando…
            </p>
          ) : null}
        </>
      )}
    </main>
  );
}

function Centro({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 flex-col items-center justify-center gap-8 p-12 text-center">{children}</div>;
}

function Painel({
  estado,
  atual,
  ultimas,
  svg,
}: {
  estado: Extract<TvEstado, { estado: "pareada" }>;
  atual: { id: string; senha: string; destino: string } | null;
  ultimas: { id: string; senha: string; destino: string }[];
  svg: string | null;
}) {
  return (
    <div className="grid flex-1 grid-cols-[2fr_1fr] grid-rows-[3fr_2fr] gap-6 p-8">
      <section
        className={`flex flex-col items-center justify-center rounded-3xl p-8 ${atual ? "bg-white text-primary-900" : "bg-white/10"}`}
        aria-live="assertive"
      >
        <p className="text-3xl font-bold tracking-widest uppercase opacity-70">chamando agora</p>
        {atual ? (
          <>
            <p className="text-[12rem] leading-none font-extrabold tracking-wider">{atual.senha}</p>
            <p className="text-6xl font-bold lowercase">→ {atual.destino}</p>
          </>
        ) : (
          <p className="mt-6 text-5xl font-bold opacity-80">
            {estado.atendimentoIniciado ? "aguarde a sua senha" : "atendimento ainda não começou"}
          </p>
        )}
      </section>
      <section className="row-span-1 rounded-3xl bg-white/10 p-8">
        <p className="mb-6 text-2xl font-bold tracking-widest uppercase opacity-70">últimas chamadas</p>
        <ul className="flex flex-col gap-5">
          {ultimas.map((c) => (
            <li key={c.id} className="flex items-baseline justify-between gap-4 text-4xl font-bold">
              <span className="tracking-wider">{c.senha}</span>
              <span className="text-3xl lowercase opacity-80">{c.destino}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="overflow-hidden rounded-3xl bg-white/10 p-8">
        <ul className="flex flex-col gap-4">
          {estado.servicos.map((s) => (
            <li key={s.nome} className="flex items-baseline gap-6 text-4xl">
              <span className="min-w-64 font-extrabold lowercase">{s.nome}</span>
              <span>{s.aguardando} aguardando</span>
              {s.aCaminho > 0 ? <span className="opacity-70">+{s.aCaminho} a caminho</span> : null}
            </li>
          ))}
        </ul>
      </section>
      <section className="flex flex-col items-center justify-center gap-4 rounded-3xl bg-white p-6 text-primary-900">
        {svg ? (
          <>
            {/* biome-ignore lint/security/noDangerouslySetInnerHtml: SVG gerado localmente pela biblioteca do QR. */}
            <div className="w-64 max-w-full" dangerouslySetInnerHTML={{ __html: svg }} />
            <p className="text-3xl font-extrabold">chegou? leia o QR</p>
          </>
        ) : (
          <p className="text-2xl font-bold">o QR aparece quando o atendimento abrir</p>
        )}
      </section>
    </div>
  );
}
