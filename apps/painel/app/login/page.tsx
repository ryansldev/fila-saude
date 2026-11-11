"use client";

import { useRouter } from "next/navigation";
import { FormularioDeLogin } from "@/components/formulario-login";
import { Logo } from "@/components/logo";

export default function Login() {
  const router = useRouter();
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <Logo className="size-14 text-primary" />
      <h1 className="text-2xl font-bold text-gray-900">Entrar no painel</h1>
      <FormularioDeLogin navegar={(href) => router.push(href)} />
    </main>
  );
}
