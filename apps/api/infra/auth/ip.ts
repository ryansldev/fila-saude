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
 * NC5: o IP como a contagem de tentativas o usa. IPv4 como está (o mapeado em IPv6 vira IPv4); IPv6 pelo
 * bloco /64, que cada cliente recebe inteiro e dentro do qual troca de endereço à vontade.
 */
export function ipKey(ip: string): string {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip)?.[1];
  if (mapped && isIPv4(mapped)) return mapped;
  if (isIPv4(ip)) return ip;
  if (!isIPv6(ip)) return "sem-ip";
  const prefix = groups(ip.toLowerCase())
    .slice(0, 4)
    .map((g) => g.toString(16))
    .join(":");
  return `${prefix}::/64`;
}
