import { type NextRequest, NextResponse } from "next/server";
import { proxyDestination, SLUG_HEADER } from "@/lib/tenant";

/** PD-09: o município vem do subdomínio; sem slug no host, mostra "município não encontrado". */
export function proxy(request: NextRequest) {
  const destination = proxyDestination(request.headers.get("host"), process.env.TENANT_BASE_DOMAIN ?? "localhost");

  if (destination.kind === "municipality_not_found") {
    return NextResponse.rewrite(new URL("/municipio-nao-encontrado", request.url));
  }

  const headers = new Headers(request.headers);
  headers.set(SLUG_HEADER, destination.slug);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
