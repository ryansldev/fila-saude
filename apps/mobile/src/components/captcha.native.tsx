import { WebView } from "react-native-webview";
import { captchaMessage } from "@/lib/captcha";
import { API_URL } from "@/lib/config";
import { CAPTCHA_HEIGHT, type CaptchaProps } from "./captcha.types";

/**
 * AD-062: no celular, o Turnstile não tem SDK nativo; a Cloudflare orienta carregar uma página nossa numa
 * WebView (`/v1/captcha` da API), com JavaScript e armazenamento ligados. A página devolve o token por
 * `postMessage`.
 */
export default function CaptchaWidget({ onToken, onError }: CaptchaProps) {
  return (
    <WebView
      source={{ uri: `${API_URL}/v1/captcha` }}
      javaScriptEnabled
      domStorageEnabled
      style={{ height: CAPTCHA_HEIGHT, width: "100%", backgroundColor: "transparent" }}
      onError={onError}
      onHttpError={onError}
      onMessage={(event) => {
        const m = captchaMessage(event.nativeEvent.data);
        if (m?.kind === "token") onToken(m.token);
        else if (m?.kind === "error") onError();
      }}
    />
  );
}
