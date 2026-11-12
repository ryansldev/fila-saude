import type { Metadata } from "next";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Município não encontrado" };

export default function MunicipioNaoEncontrado() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <Logo className="size-14 text-primary" />
      <h1 className="text-2xl font-bold text-gray-900">município não encontrado</h1>
      <p className="max-w-md text-gray-600">
        confira o endereço: o painel abre no endereço do seu município, como{" "}
        <strong>seu-municipio.filasaude.com.br</strong>.
      </p>
    </main>
  );
}
