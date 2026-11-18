import Fastify from "fastify";
import { trustProxyOption, webRequest } from "infra/auth/fastify";
import { describe, expect, it } from "vitest";

// O better-auth lê o IP do `X-Forwarded-For`. A API entrega a ele só o IP que o Fastify resolveu
// (pelo `trustProxy`), nunca o cabeçalho que o cliente mandou.
async function seen(
  options: { trustProxy?: string[]; remoteAddress: string; header?: string; extra?: Record<string, string> },
  read: (r: Request) => string | null,
) {
  const app = Fastify({ trustProxy: trustProxyOption(options.trustProxy ?? []) });
  app.get("/", async (req) => read(webRequest(req)) ?? "(nenhum)");
  const res = await app.inject({
    method: "GET",
    url: "/",
    remoteAddress: options.remoteAddress,
    headers: {
      host: "api.exemplo.gov.br",
      ...(options.header ? { "x-forwarded-for": options.header } : {}),
      ...options.extra,
    },
  });
  await app.close();
  return res.body;
}

const forwardedFor = (options: Parameters<typeof seen>[0]) => seen(options, (r) => r.headers.get("x-forwarded-for"));

describe("AD-064: IP confiável do cliente", () => {
  it("sem proxy confiável, o X-Forwarded-For do cliente é ignorado: vale o IP da conexão", async () => {
    expect(await forwardedFor({ remoteAddress: "203.0.113.7", header: "198.51.100.1" })).toBe("203.0.113.7");
  });

  it("atrás de um proxy confiável, vale o IP que o proxy informou", async () => {
    const ip = await forwardedFor({ trustProxy: ["127.0.0.1"], remoteAddress: "127.0.0.1", header: "198.51.100.1" });
    expect(ip).toBe("198.51.100.1");
  });

  it("o cliente não fura o proxy pondo um IP inventado à esquerda", async () => {
    const ip = await forwardedFor({
      trustProxy: ["127.0.0.1"],
      remoteAddress: "127.0.0.1",
      header: "10.9.9.9, 198.51.100.1",
    });
    expect(ip).toBe("198.51.100.1");
  });

  it("uma conexão que não vem do proxy não escolhe o próprio IP", async () => {
    const ip = await forwardedFor({ trustProxy: ["127.0.0.1"], remoteAddress: "203.0.113.7", header: "198.51.100.1" });
    expect(ip).toBe("203.0.113.7");
  });

  it("sem proxy configurado, nada é confiado (nunca 'confiar em todos')", () => {
    expect(trustProxyOption([])).toBe(false);
    expect(trustProxyOption(["loopback"])).toEqual(["loopback"]);
  });

  it("outros cabeçalhos de IP que o cliente manda não chegam ao better-auth", async () => {
    const extra = { "x-real-ip": "198.51.100.9", forwarded: "for=198.51.100.9" };
    const body = await seen({ remoteAddress: "203.0.113.7", extra }, (r) =>
      [r.headers.get("x-real-ip"), r.headers.get("forwarded")].join("|"),
    );
    expect(body).toBe("|");
  });

  it("o endereço entregue ao better-auth usa o Host do pedido, não o X-Forwarded-Host (que o cliente forja)", async () => {
    const extra = { "x-forwarded-host": "a b" };
    const host = await seen(
      { trustProxy: ["127.0.0.1"], remoteAddress: "127.0.0.1", extra },
      (r) => new URL(r.url).host,
    );
    expect(host).toBe("api.exemplo.gov.br");
  });
});
