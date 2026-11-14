"use client";

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
  const enviando = estado.estado === "enviando";

  function aoEnviar(e: FormEvent) {
    e.preventDefault();
    void enviar(login, senha);
  }

  return (
    <form onSubmit={aoEnviar} className="flex w-full max-w-sm flex-col gap-4">
      <Campo rotulo="Login">
        <Texto type="text" autoComplete="username" autoCapitalize="none" required valor={login} aoMudar={setLogin} />
      </Campo>
      <Campo rotulo="Senha">
        <Texto type="password" autoComplete="current-password" required valor={senha} aoMudar={setSenha} />
      </Campo>
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
