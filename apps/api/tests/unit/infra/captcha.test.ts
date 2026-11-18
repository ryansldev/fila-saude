import { turnstileVerify } from "infra/captcha";
import { describe, expect, it } from "vitest";

const answer = (body: unknown) => async () => new Response(JSON.stringify(body));

describe("AD-062: conferência do Turnstile na Cloudflare", () => {
  it("manda segredo, token e IP, e aceita só quando a Cloudflare diz que passou", async () => {
    let sent: URLSearchParams | undefined;
    const fetcher = (async (_url: string, init: RequestInit) => {
      sent = init.body as URLSearchParams;
      return new Response(JSON.stringify({ success: true }));
    }) as unknown as typeof fetch;
    expect(await turnstileVerify("segredo", "tok", "203.0.113.7", fetcher)).toBe(true);
    expect(sent?.get("secret")).toBe("segredo");
    expect(sent?.get("response")).toBe("tok");
    expect(sent?.get("remoteip")).toBe("203.0.113.7");
  });

  it("recusa quando a Cloudflare recusa, quando não responde e quando não há token", async () => {
    expect(await turnstileVerify("s", "tok", "1.1.1.1", answer({ success: false }) as unknown as typeof fetch)).toBe(
      false,
    );
    const down = (async () => {
      throw new Error("rede");
    }) as unknown as typeof fetch;
    expect(await turnstileVerify("s", "tok", "1.1.1.1", down)).toBe(false);
    expect(await turnstileVerify("s", "", "1.1.1.1", answer({ success: true }) as unknown as typeof fetch)).toBe(false);
  });
});
