import { type NextRequest, NextResponse } from "next/server";
import { CABECALHO_SLUG, destinoDoProxy } from "@/lib/tenant";

/** PD-09: o município vem do subdomínio; sem slug no host, mostra "município não encontrado". */
export function proxy(request: NextRequest) {
  const destino = destinoDoProxy(request.headers.get("host"), process.env.DOMINIO_BASE ?? "localhost");

  if (destino.tipo === "municipio_nao_encontrado") {
    return NextResponse.rewrite(new URL("/municipio-nao-encontrado", request.url));
  }

  const headers = new Headers(request.headers);
  headers.set(CABECALHO_SLUG, destino.slug);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
