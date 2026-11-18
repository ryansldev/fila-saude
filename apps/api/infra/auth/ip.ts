import { isIPv4, isIPv6 } from "node:net";

// Os 8 grupos de um IPv6 válido, em números (o "::" expandido; um IPv4 no fim vira os dois últimos).
function groups(ip: string): number[] {
  const [head = "", tail] = ip.split("::");
  const parse = (part: string) =>
    part === ""
      ? []
      : part.split(":").flatMap((g) => {
          if (!g.includes(".")) return [Number.parseInt(g, 16)];
          const [a = 0, b = 0, c = 0, d = 0] = g.split(".").map(Number);
          return [(a << 8) | b, (c << 8) | d];
        });
  const left = parse(head);
  const right = tail === undefined ? [] : parse(tail);
  return [...left, ...Array(8 - left.length - right.length).fill(0), ...right];
}

/**
 * AD-064: o IP como a contagem de tentativas o usa. IPv4 como está (o mapeado em IPv6 vira IPv4); IPv6 pelo
 * bloco /64, que cada cliente recebe inteiro e dentro do qual troca de endereço à vontade.
 */
export function ipKey(ip: string): string {
  if (isIPv4(ip)) return ip;
  if (!isIPv6(ip)) return "sem-ip";
  const g = groups(ip.toLowerCase());
  // IPv4 mapeado (::ffff:a.b.c.d, também em hexadecimal): é o IPv4.
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) {
    const [hi = 0, lo = 0] = g.slice(6);
    return [hi >> 8, hi & 255, lo >> 8, lo & 255].join(".");
  }
  const prefix = g
    .slice(0, 4)
    .map((g) => g.toString(16))
    .join(":");
  return `${prefix}::/64`;
}
