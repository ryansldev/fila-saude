"use client";

import type { TvEstado, TvRegistro } from "@fila-saude/schemas/tv";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Logo } from "@/components/logo";
import { PainelDaTv } from "@/components/tv/painel-da-tv";
import { Button } from "@/components/ui/button";
import { qrEstilizado } from "@/lib/qr";
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

/** O QR de entrada do design system (pontos pretos, coração azul), o mesmo do painel e do monitor. */
function useSvgDoQr(conteudo: string | null) {
  return useMemo(() => (conteudo ? qrEstilizado(conteudo) : null), [conteudo]);
}

/** T3.5: TV da sala de espera. Pareamento (RN-TV-01), só senhas (RN-TV-05), fila de anúncios (RN-TV-07). */
export default function Tv() {
  const [estado, setEstado] = useState<TvEstado | null>(null);
  const [falhas, setFalhas] = useState(0);
  const [iniciado, setIniciado] = useState(false);
  const [anuncios, setAnuncios] = useState<Anuncios>(ANUNCIOS_VAZIOS);
  // A hora do topo, pelo relógio da TV.
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 10_000);
    return () => clearInterval(id);
  }, []);
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
    <main className="flex min-h-screen flex-col bg-white font-[family-name:var(--font-nunito)] text-[#0c2e4e]">
      {offline ? (
        <Centro>
          <p className="text-5xl font-extrabold">reconectando…</p>
          <p className="text-2xl text-slate-500">a fila volta a aparecer quando a internet voltar.</p>
        </Centro>
      ) : !estado ? (
        <Centro>
          <Logo className="size-24 text-primary" />
        </Centro>
      ) : estado.estado === "aguardando" ? (
        <Centro>
          <Logo className="size-20 text-primary" />
          <p className="text-3xl">para ligar esta TV, digite no painel da unidade o código</p>
          <p className="rounded-3xl bg-[#eef5fa] px-16 py-8 font-mono text-[10rem] leading-none font-extrabold tracking-[0.2em] text-[#0c2e4e]">
            {estado.codigo}
          </p>
          <p className="text-xl text-slate-500">no painel: TVs › parear TV</p>
        </Centro>
      ) : !iniciado ? (
        <Centro>
          <Logo className="size-20 text-primary" />
          <p className="text-4xl font-bold">{estado.unidade.nome}</p>
          <Button
            variante="principal"
            className="h-24 rounded-2xl px-12 text-4xl"
            onClick={() => {
              // RN-TV-04: o navegador só libera o som depois de um toque.
              audio.current = new AudioContext();
              setIniciado(true);
            }}
          >
            iniciar painel
          </Button>
          <p className="text-xl text-slate-500">toque uma vez para ligar o som das chamadas.</p>
        </Centro>
      ) : (
        <>
          <PainelDaTv
            agora={agora}
            estado={estado}
            atual={anuncios.atual?.chamada ?? null}
            ultimas={ultimasAnunciadas(anuncios, estado.chamadas).slice(0, 4)}
            svg={semConexao ? null : svg}
          />
          {semConexao ? (
            <p className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-amber-100 px-5 py-2 text-xl font-bold text-amber-900">
              sem conexão, reconectando…
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
