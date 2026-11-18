"use client";

import { type FormEvent, useState } from "react";
import { FormField, Password, Text } from "@/components/form";
import { Button } from "@/components/ui/button";
import { type LoginError, useLogin } from "@/lib/session";

const MESSAGES: Record<LoginError, string> = {
  credentials: "Login ou senha inválidos.",
  // RN-ID-04: o texto com o tempo do bloqueio vem do servidor; este é só o reserva.
  locked: "Muitas tentativas com senha errada. Espere e tente de novo.",
  rate_limited: "Muitas tentativas seguidas. Espere alguns segundos e tente de novo.",
  network: "Não foi possível entrar agora. Tente de novo.",
};

export function LoginForm({ navigate }: { navigate: (href: string) => void }) {
  const { state, send } = useLogin(navigate);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const sending = state.state === "sending";

  function onSend(e: FormEvent) {
    e.preventDefault();
    void send(login, password);
  }

  return (
    <form onSubmit={onSend} className="flex w-full flex-col gap-5">
      <FormField label="Login">
        <Text type="text" autoComplete="username" autoCapitalize="none" required value={login} onChange={setLogin} />
      </FormField>
      <FormField label="Senha">
        <Password autoComplete="current-password" required value={password} onChange={setPassword} />
      </FormField>
      {state.state === "error" ? (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
          {state.error === "locked" && state.message ? state.message : MESSAGES[state.error]}
        </p>
      ) : null}
      <Button type="submit" disabled={sending} className="w-full">
        {sending ? "Entrando..." : "Entrar"}
      </Button>
    </form>
  );
}
