"use client";

import { EyeIcon, EyeOffIcon } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Campo, Texto } from "@/components/formulario";
import { Button } from "@/components/ui/button";
import { type ErroDeLogin, useLogin } from "@/lib/sessao";

const MENSAGENS: Record<ErroDeLogin, string> = {
  credenciais: "Login ou senha inválidos.",
  bloqueado: "Conta bloqueada. Procure o gestor do município.",
  rede: "Não foi possível entrar agora. Tente de novo.",
};

export function FormularioDeLogin({ navegar }: { navegar: (href: string) => void }) {
  const { estado, enviar } = useLogin(navegar);
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const enviando = estado.estado === "enviando";

  function aoEnviar(e: FormEvent) {
    e.preventDefault();
    void enviar(login, senha);
  }

  return (
    <form onSubmit={aoEnviar} className="flex w-full flex-col gap-5">
      <Campo rotulo="Login">
        <Texto type="text" autoComplete="username" autoCapitalize="none" required valor={login} aoMudar={setLogin} />
      </Campo>
      <Campo rotulo="Senha">
        <div className="relative">
          <Texto
            type={verSenha ? "text" : "password"}
            autoComplete="current-password"
            required
            valor={senha}
            aoMudar={setSenha}
            className="pr-12"
          />
          <button
            type="button"
            onClick={() => setVerSenha(!verSenha)}
            aria-label={verSenha ? "Esconder senha" : "Mostrar senha"}
            title={verSenha ? "Esconder senha" : "Mostrar senha"}
            className="absolute inset-y-0 right-1 flex w-10 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-primary"
          >
            {verSenha ? <EyeOffIcon className="size-5" /> : <EyeIcon className="size-5" />}
          </button>
        </div>
      </Campo>
      {estado.estado === "erro" ? (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
          {MENSAGENS[estado.erro]}
        </p>
      ) : null}
      <Button type="submit" disabled={enviando} className="w-full">
        {enviando ? "Entrando..." : "Entrar"}
      </Button>
    </form>
  );
}
