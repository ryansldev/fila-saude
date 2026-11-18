"use client";

import { turnstileSiteKey } from "@fila-saude/schemas/captcha";
import { useEffect, useRef } from "react";

// AD-062: chave pública do site no Turnstile; sem ela, a de teste fora de produção (em produção, sem widget).
const SITE_KEY = turnstileSiteKey(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY, process.env.NODE_ENV === "production");
const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileApi = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let loading: Promise<TurnstileApi> | null = null;

// O script da Cloudflare entra uma vez por página.
function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile")));
    script.onerror = () => {
      loading = null;
      reject(new Error("turnstile"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/** AD-062: widget do Cloudflare Turnstile; entrega o token (que vale uma vez) ou avisa que falhou. */
export function Turnstile({ onToken, onError }: { onToken: (token: string) => void; onError?: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  // As funções mais recentes, lidas na hora: o widget não é refeito a cada renderização da página (o
  // desafio em andamento e o token se perderiam).
  const latest = useRef({ onToken, onError });
  latest.current = { onToken, onError };
  useEffect(() => {
    let id: string | null = null;
    let active = true;
    if (SITE_KEY === null) {
      latest.current.onError?.();
      return;
    }
    loadTurnstile()
      .then((api) => {
        if (!active || !box.current) return;
        id = api.render(box.current, {
          sitekey: SITE_KEY,
          language: "pt-br",
          callback: (token: string) => latest.current.onToken(token),
          "error-callback": () => latest.current.onError?.(),
        });
      })
      .catch(() => latest.current.onError?.());
    return () => {
      active = false;
      if (id !== null) window.turnstile?.remove(id);
    };
  }, []);
  return <div ref={box} className="flex justify-center" />;
}
