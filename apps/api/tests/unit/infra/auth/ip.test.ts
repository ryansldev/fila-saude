import { ipKey } from "infra/auth/ip";
import { describe, expect, it } from "vitest";

describe("AD-064: IP da contagem", () => {
  it("IPv4 fica como está", () => {
    expect(ipKey("203.0.113.7")).toBe("203.0.113.7");
  });

  it("IPv4 mapeado em IPv6 vira o IPv4", () => {
    expect(ipKey("::ffff:203.0.113.7")).toBe("203.0.113.7");
  });

  it("IPv6 conta pelo bloco /64, escrito de qualquer jeito", () => {
    expect(ipKey("2001:db8:1:2::5")).toBe("2001:db8:1:2::/64");
    expect(ipKey("2001:DB8:0001:0002:aaaa:bbbb:cccc:dddd")).toBe("2001:db8:1:2::/64");
    expect(ipKey("::1")).toBe("0:0:0:0::/64");
  });

  it("o que não é IP vira uma marca só", () => {
    expect(ipKey("")).toBe("sem-ip");
    expect(ipKey("caddy")).toBe("sem-ip");
  });
});
