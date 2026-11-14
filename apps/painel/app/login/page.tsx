"use client";

import { useRouter } from "next/navigation";
import { FormularioDeLogin } from "@/components/formulario-login";
import { Logo } from "@/components/logo";

/** Uma chamada como a TV da sala de espera mostra: o momento que o sistema existe para organizar. */
function ChamadaDeExemplo() {
  const ultimas = [
    { senha: "C-011", destino: "consultório 1" },
    { senha: "V-004", destino: "sala de procedimentos" },
    { senha: "C-010", destino: "triagem" },
  ];
  return (
    <div aria-hidden className="w-full max-w-md select-none">
      <div className="rounded-3xl bg-white p-8 text-slate-900 shadow-[0_12px_0_0_rgb(0_0_0/0.12)]">
        <p className="text-sm font-bold text-primary-600">chamando agora</p>
        <p className="mt-2 font-mono text-7xl font-extrabold tracking-wider">C-012</p>
        <p className="mt-1 text-2xl font-bold text-slate-600">consultório 3</p>
      </div>
      <ul className="mt-5 flex flex-col gap-2 px-2">
        {ultimas.map((c) => (
          <li key={c.senha} className="flex items-baseline justify-between text-white/80">
            <span className="font-mono text-xl font-bold text-white">{c.senha}</span>
            <span className="text-base">{c.destino}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Login() {
  const router = useRouter();
  return (
    <main className="grid min-h-screen flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section className="flex flex-col justify-between gap-10 bg-white px-6 py-8 sm:px-12 lg:px-16">
        <div className="flex items-center gap-2.5">
          <Logo className="size-9 text-primary" />
          <span className="text-lg font-extrabold tracking-tight text-slate-900">fila saúde</span>
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-col gap-8">
          <div className="flex flex-col gap-2">
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">Entrar no painel</h1>
            <p className="text-slate-500">Para a equipe das unidades e da secretaria de saúde.</p>
          </div>
          <FormularioDeLogin navegar={(href) => router.push(href)} />
          <p className="text-sm text-slate-500">
            Esqueceu a senha ou o login? Peça a quem cadastra a equipe da sua unidade.
          </p>
        </div>
        <p className="text-xs text-slate-400">Fila Saúde · espera em casa, atendimento na hora certa.</p>
      </section>
      <section className="relative hidden flex-col items-center justify-center gap-10 overflow-hidden bg-primary px-12 lg:flex">
        <div className="relative flex w-full max-w-md flex-col gap-3">
          <p className="text-3xl leading-tight font-extrabold text-white">
            A fila da unidade, organizada do balcão à TV da sala de espera.
          </p>
          <p className="text-lg text-white/80">
            Quem espera em casa sabe a hora de sair. Quem chega lê o QR. A recepção vê quem precisa de ajuda.
          </p>
        </div>
        <div className="relative w-full max-w-md">
          <ChamadaDeExemplo />
        </div>
      </section>
    </main>
  );
}
