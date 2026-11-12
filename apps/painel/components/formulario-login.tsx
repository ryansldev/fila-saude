"use client";

import { type FormEvent, useState } from "react";
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
  const enviando = estado.estado === "enviando";

  function aoEnviar(e: FormEvent) {
    e.preventDefault();
    void enviar(login, senha);
  }

  const campo =
    "w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus-visible:outline-2 focus-visible:outline-primary";

  return (
    <form onSubmit={aoEnviar} className="flex w-full max-w-sm flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        Login
        <input
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          required
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          className={campo}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        Senha
        <input
          type="password"
          autoComplete="current-password"
          required
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className={campo}
        />
      </label>
      {estado.estado === "erro" ? (
        <p role="alert" className="text-sm text-red-700">
          {MENSAGENS[estado.erro]}
        </p>
      ) : null}
      <Button type="submit" disabled={enviando}>
        {enviando ? "Entrando..." : "Entrar"}
      </Button>
    </form>
  );
}
