import webserver from "infra/webserver";
import orchestrator from "tests/orchestrator";
import { beforeAll, describe, expect, it } from "vitest";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
});

describe("AD-062: página do captcha para a WebView do app", () => {
  it("serve o widget do Turnstile com a chave do site e devolve o token ao app", async () => {
    const r = await fetch(`${webserver.origin}/v1/captcha`);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toMatch(/text\/html/);
    const html = await r.text();
    expect(html).toContain("https://challenges.cloudflare.com/turnstile/v0/api.js");
    expect(html).toContain("1x00000000000000000000AA");
    expect(html).toContain("ReactNativeWebView");
    // A WebView do app tem 80 px: o widget (65 px) cabe sem margem em cima e embaixo.
    expect(html).not.toMatch(/padding:\s*16px/);
  });
});
