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
    expect(await turnstileVerify("segredo", "tok", "203.0.113.7", fetcher)).toBe("ok");
    expect(sent?.get("secret")).toBe("segredo");
    expect(sent?.get("response")).toBe("tok");
    expect(sent?.get("remoteip")).toBe("203.0.113.7");
  });

  it("recusa quando a Cloudflare recusa ou não responde", async () => {
    expect(
      await turnstileVerify(
        "s",
        "tok",
        "1.1.1.1",
        answer({ success: false, "error-codes": ["invalid-input-response"] }) as unknown as typeof fetch,
      ),
    ).toBe("rejected");
    const down = (async () => {
      throw new Error("rede");
    }) as unknown as typeof fetch;
    // Sem resposta da Cloudflare não é "recusado": é "indisponível" (não conta como erro de ninguém).
    expect(await turnstileVerify("s", "tok", "1.1.1.1", down)).toBe("unavailable");
    expect(
      await turnstileVerify(
        "s",
        "tok",
        "1.1.1.1",
        (async () => new Response("<html>", { status: 502 })) as unknown as typeof fetch,
      ),
    ).toBe("unavailable");
  });

  it("erro do lado da Cloudflare (internal-error) é 'indisponível', não culpa de quem mandou o token", async () => {
    const internal = answer({ success: false, "error-codes": ["internal-error"] }) as unknown as typeof fetch;
    expect(await turnstileVerify("s", "tok", "1.1.1.1", internal)).toBe("unavailable");
    const invalid = answer({ success: false, "error-codes": ["invalid-input-response"] }) as unknown as typeof fetch;
    expect(await turnstileVerify("s", "tok", "1.1.1.1", invalid)).toBe("rejected");
  });

  it("só token inválido é culpa de quem mandou; vencido ou repetido é 'vencido'; erro de configuração nosso é 'indisponível'", async () => {
    const codes = (c: string[]) => answer({ success: false, "error-codes": c }) as unknown as typeof fetch;
    expect(await turnstileVerify("s", "tok", "1.1.1.1", codes(["invalid-input-response"]))).toBe("rejected");
    expect(await turnstileVerify("s", "tok", "1.1.1.1", codes(["timeout-or-duplicate"]))).toBe("expired");
    expect(await turnstileVerify("s", "tok", "1.1.1.1", codes(["invalid-input-secret"]))).toBe("unavailable");
    expect(await turnstileVerify("s", "tok", "1.1.1.1", codes(["missing-input-secret"]))).toBe("unavailable");
    expect(await turnstileVerify("s", "tok", "1.1.1.1", codes(["bad-request"]))).toBe("unavailable");
  });

  it("código que não conhecemos vai para o log (senão uma mudança da Cloudflare pareceria ela fora do ar)", async () => {
    const { attemptErrors } = await import("infra/auth/attempts");
    const logged: string[] = [];
    const original = attemptErrors.log;
    attemptErrors.log = (error) => logged.push(String(error));
    try {
      const odd = answer({ success: false, "error-codes": ["codigo-novo"] }) as unknown as typeof fetch;
      expect(await turnstileVerify("s", "tok", "1.1.1.1", odd)).toBe("unavailable");
      expect(logged.join()).toContain("codigo-novo");
    } finally {
      attemptErrors.log = original;
    }
  });
});
