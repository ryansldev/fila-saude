"use client";

import { createContext, type ReactNode, useCallback, useContext, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

// Confirmação e pergunta com motivo em diálogo do shadcn, no lugar de window.confirm/prompt.
// Uso: `if (!(await confirmar({ titulo: "Encerrar a sessão?" }))) return;`

type Confirmacao = { titulo: string; descricao?: string; acao?: string; perigo?: boolean };
type Pergunta = { titulo: string; descricao?: string; rotulo: string; acao?: string };

type Pedido =
  | ({ tipo: "confirmar"; resolver: (ok: boolean) => void } & Confirmacao)
  | ({ tipo: "perguntar"; resolver: (texto: string | null) => void } & Pergunta);

const Contexto = createContext<{
  confirmar: (c: Confirmacao) => Promise<boolean>;
  perguntar: (p: Pergunta) => Promise<string | null>;
} | null>(null);

export function ProvedorDeDialogos({ children }: { children: ReactNode }) {
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [texto, setTexto] = useState("");
  const [tentou, setTentou] = useState(false);
  const atual = useRef<Pedido | null>(null);

  const abrir = (p: Pedido) => {
    atual.current = p;
    setTexto("");
    setTentou(false);
    setPedido(p);
  };
  const fechar = (resposta: boolean) => {
    const p = atual.current;
    atual.current = null;
    setPedido(null);
    if (!p) return;
    if (p.tipo === "confirmar") p.resolver(resposta);
    else p.resolver(resposta ? texto.trim() : null);
  };

  const confirmar = useCallback(
    (c: Confirmacao) => new Promise<boolean>((resolver) => abrir({ tipo: "confirmar", resolver, ...c })),
    [],
  );
  const perguntar = useCallback(
    (p: Pergunta) => new Promise<string | null>((resolver) => abrir({ tipo: "perguntar", resolver, ...p })),
    [],
  );

  const vazio = pedido?.tipo === "perguntar" && !texto.trim();
  return (
    <Contexto.Provider value={{ confirmar, perguntar }}>
      {children}
      <AlertDialog open={pedido !== null} onOpenChange={(aberto) => !aberto && fechar(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pedido?.titulo}</AlertDialogTitle>
            {pedido?.descricao ? <AlertDialogDescription>{pedido.descricao}</AlertDialogDescription> : null}
          </AlertDialogHeader>
          {pedido?.tipo === "perguntar" ? (
            <Field data-invalid={tentou && vazio ? true : undefined}>
              <FieldLabel htmlFor="dialogo-texto">{pedido.rotulo}</FieldLabel>
              <Textarea
                id="dialogo-texto"
                autoFocus
                value={texto}
                aria-invalid={(tentou && vazio) || undefined}
                onChange={(e) => setTexto(e.target.value)}
              />
              {tentou && vazio ? <FieldError>Escreva o motivo.</FieldError> : null}
            </Field>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              variant={pedido?.tipo === "confirmar" && pedido.perigo ? "destructive" : "default"}
              onClick={() => {
                if (vazio) return setTentou(true);
                fechar(true);
              }}
            >
              {pedido?.acao ?? "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Contexto.Provider>
  );
}

function useDialogos() {
  const c = useContext(Contexto);
  if (!c) throw new Error("ProvedorDeDialogos ausente");
  return c;
}

/** Diálogo "tem certeza?"; resolve true só no botão de ação. */
export const useConfirmar = () => useDialogos().confirmar;
/** Diálogo com campo de texto obrigatório (ex.: motivo); resolve null se voltar. */
export const usePerguntar = () => useDialogos().perguntar;
