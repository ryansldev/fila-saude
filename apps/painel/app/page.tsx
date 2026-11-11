import { headers } from "next/headers";
import { Logo } from "@/components/logo";
import { CABECALHO_SLUG } from "@/lib/tenant";

export default async function Inicio() {
  const slug = (await headers()).get(CABECALHO_SLUG);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <Logo className="size-14 text-primary" />
      <h1 className="text-2xl font-bold text-gray-900">Painel do Fila Saúde</h1>
      {slug ? <p className="text-gray-600">município: {slug}</p> : null}
    </main>
  );
}
