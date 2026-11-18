"use client";

import type { TvRecord, TvState } from "@fila-saude/schemas/tv";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Logo } from "@/components/logo";
import { TvPanel } from "@/components/tv/tv-panel";
import { Button } from "@/components/ui/button";
import { styledQr } from "@/lib/qr";
import { apiUrl } from "@/lib/tenant";
import { type Announcements, advanceAnnouncements, EMPTY_ANNOUNCEMENTS, lastAnnounced, receiveCalls } from "@/lib/tv";

const KEY = "fila-saude:tv";
const QUERY_MS = 2_000; // PD-48
const OFFLINE_AFTER = 3; // leituras seguidas sem resposta: aviso discreto
const OFFLINE_LONG = 30; // ~1 min sem resposta: tela de "reconectando"

const readToken = () => {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
};
const saveToken = (t: string | null) => {
  try {
    if (t) window.localStorage.setItem(KEY, t);
    else window.localStorage.removeItem(KEY);
  } catch {}
};

/** RN-TV-04: dois tons gerados no navegador, sem voz. */
function tapNotice(ctx: AudioContext | null) {
  if (!ctx) return;
  const tone = (freq: number, start: number) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, ctx.currentTime + start);
    g.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + 0.45);
    o.connect(g).connect(ctx.destination);
    o.start(ctx.currentTime + start);
    o.stop(ctx.currentTime + start + 0.5);
  };
  tone(880, 0);
  tone(660, 0.5);
}

/** O QR de entrada do design system (pontos pretos, coração azul), o mesmo do painel e do monitor. */
function useQrSvg(content: string | null) {
  return useMemo(() => (content ? styledQr(content) : null), [content]);
}

/** T3.5: TV da sala de espera. Pareamento (RN-TV-01), só senhas (RN-TV-05), fila de anúncios (RN-TV-07). */
export default function Tv() {
  const [state, setState] = useState<TvState | null>(null);
  const [failures, setFailures] = useState(0);
  const [started, setStarted] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcements>(EMPTY_ANNOUNCEMENTS);
  // A hora do topo: o relógio da TV corrigido pela diferença para o servidor (o da TV pode estar errado).
  const [now, setNow] = useState(() => Date.now());
  const [skew, setSkew] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(id);
  }, []);
  const audio = useRef<AudioContext | null>(null);
  const paired = state?.state === "paired" ? state : null;
  const svg = useQrSvg(paired?.qr?.content ?? null);

  const base = useCallback(
    () => apiUrl(window.location, { NEXT_PUBLIC_API_PORT: process.env.NEXT_PUBLIC_API_PORT }),
    [],
  );

  useEffect(() => {
    let active = true;
    const register = async () => {
      const r = await fetch(`${base()}/v1/tv`, { method: "POST" });
      if (!r.ok) throw new Error("registro");
      const data = (await r.json()) as TvRecord;
      saveToken(data.token);
      return data.token;
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Uma consulta por vez: a próxima só sai depois da resposta (senão duas leituras sem token
    // registravam duas TVs e o código piscava).
    const load = async () => {
      try {
        const token = readToken() ?? (await register());
        const r = await fetch(`${base()}/v1/tv/screen`, { headers: { authorization: `Bearer ${token}` } });
        // RN-TV-01: revogada, desconhecida ou código vencido (o servidor decide): volta ao pareamento.
        if (r.status === 401) saveToken(null);
        else {
          if (!r.ok) throw new Error(String(r.status));
          const data = (await r.json()) as TvState;
          if (!active) return;
          setState(data);
          setFailures(0);
          if (data.state === "paired") {
            const maxDelay = data.highlightSeconds * 2000;
            // A chamada é "recente" pela hora do servidor, não pela da TV.
            const serverNow = Date.parse(data.now);
            setSkew(serverNow - Date.now());
            setAnnouncements((a) => receiveCalls(a, data.calls, serverNow, maxDelay));
          }
        }
      } catch {
        if (active) setFailures((f) => f + 1);
      }
      if (active) timer = setTimeout(load, QUERY_MS);
    };
    void load();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [base]);

  const highlightMs = (paired?.highlightSeconds ?? 10) * 1000;
  useEffect(() => {
    const id = setInterval(() => setAnnouncements((a) => advanceAnnouncements(a, Date.now(), highlightMs).state), 250);
    return () => clearInterval(id);
  }, [highlightMs]);

  // RN-TV-04: o som toca uma vez por anúncio, fora do atualizador de estado (que o React pode repetir).
  const announcing = announcements.current?.call.id ?? null;
  useEffect(() => {
    if (announcing) tapNotice(audio.current);
  }, [announcing]);

  // RN-TV-06: queda curta mantém a última tela com um aviso; só uma queda longa troca a tela.
  const disconnected = failures >= OFFLINE_AFTER;
  const offline = failures >= OFFLINE_LONG || (disconnected && state?.state !== "paired");

  return (
    <main className="flex min-h-screen flex-col bg-white font-[family-name:var(--font-nunito)] text-[#0c2e4e]">
      {offline ? (
        <Center>
          <p className="text-5xl font-extrabold">reconectando…</p>
          <p className="text-2xl text-slate-500">a fila volta a aparecer quando a internet voltar.</p>
        </Center>
      ) : !state ? (
        <Center>
          <Logo className="size-24 text-primary" />
        </Center>
      ) : state.state === "waiting" ? (
        <Center>
          <Logo className="size-20 text-primary" />
          <p className="text-3xl">para ligar esta TV, digite no painel da unidade o código</p>
          <p className="rounded-3xl bg-[#eef5fa] px-16 py-8 font-mono text-[10rem] leading-none font-extrabold tracking-[0.2em] text-[#0c2e4e]">
            {state.code}
          </p>
          <p className="text-xl text-slate-500">no painel: TVs › parear TV</p>
        </Center>
      ) : !started ? (
        <Center>
          <Logo className="size-20 text-primary" />
          <p className="text-4xl font-bold">{state.unit.name}</p>
          <Button
            variant="primary"
            className="h-24 rounded-2xl px-12 text-4xl"
            onClick={() => {
              // RN-TV-04: o navegador só libera o som depois de um toque.
              audio.current = new AudioContext();
              setStarted(true);
            }}
          >
            iniciar painel
          </Button>
          <p className="text-xl text-slate-500">toque uma vez para ligar o som das chamadas.</p>
        </Center>
      ) : (
        <>
          <TvPanel
            now={now + skew}
            state={state}
            current={announcements.current?.call ?? null}
            last={lastAnnounced(announcements, state.calls).slice(0, 4)}
            svg={disconnected ? null : svg}
          />
          {disconnected ? (
            <p className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-amber-100 px-5 py-2 text-xl font-bold text-amber-900">
              sem conexão, reconectando…
            </p>
          ) : null}
        </>
      )}
    </main>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 flex-col items-center justify-center gap-8 p-12 text-center">{children}</div>;
}
