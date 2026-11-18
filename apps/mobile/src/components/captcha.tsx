import { turnstileSiteKey } from "@fila-saude/schemas/captcha";
import { type ComponentRef, useEffect, useRef } from "react";
import { View } from "react-native";
import { CAPTCHA_HEIGHT, type CaptchaProps } from "./captcha.types";

// AD-062: chave pública do site no Turnstile; sem ela, a de teste fora de produção (em produção, sem widget).
const SITE_KEY = turnstileSiteKey(process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY, process.env.NODE_ENV === "production");
const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileApi = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
};
type WithTurnstile = typeof globalThis & { turnstile?: TurnstileApi };

let loading: Promise<TurnstileApi> | null = null;

// O script da Cloudflare entra uma vez por página.
function loadTurnstile(): Promise<TurnstileApi> {
  const w = window as WithTurnstile;
  if (w.turnstile) return Promise.resolve(w.turnstile);
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT;
    script.async = true;
    script.onload = () => {
      if (w.turnstile) return resolve(w.turnstile);
      // Carregou sem o widget (bloqueador): a próxima tentativa carrega de novo.
      loading = null;
      reject(new Error("turnstile"));
    };
    script.onerror = () => {
      loading = null;
      reject(new Error("turnstile"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/** AD-062: na web (react-native-web), o widget entra direto na página, sem WebView. */
export default function CaptchaWidget({ onToken, onError }: CaptchaProps) {
  // No react-native-web, a `View` é um `div`: o widget é desenhado dentro dela.
  const box = useRef<ComponentRef<typeof View>>(null);
  // As funções mais recentes, lidas na hora: o widget não é refeito a cada renderização da tela.
  const latest = useRef({ onToken, onError });
  latest.current = { onToken, onError };
  useEffect(() => {
    let id: string | null = null;
    let active = true;
    if (SITE_KEY === null) {
      latest.current.onError();
      return;
    }
    loadTurnstile()
      .then((api) => {
        const el = box.current as unknown as HTMLElement | null;
        if (!active || !el) return;
        id = api.render(el, {
          sitekey: SITE_KEY,
          language: "pt-br",
          callback: (token: string) => latest.current.onToken(token),
          "error-callback": () => latest.current.onError(),
        });
      })
      .catch(() => latest.current.onError());
    return () => {
      active = false;
      if (id !== null) (window as WithTurnstile).turnstile?.remove(id);
    };
  }, []);
  return <View ref={box} style={{ minHeight: CAPTCHA_HEIGHT, alignItems: "center" }} />;
}
