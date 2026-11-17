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

type Confirmation = { title: string; description?: string; action?: string; danger?: boolean };
type Question = { title: string; description?: string; label: string; action?: string };

type Request =
  | ({ kind: "confirm"; resolve: (ok: boolean) => void } & Confirmation)
  | ({ kind: "ask"; resolve: (text: string | null) => void } & Question);

const Context = createContext<{
  confirm: (c: Confirmation) => Promise<boolean>;
  ask: (p: Question) => Promise<string | null>;
} | null>(null);

export function DialogsProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<Request | null>(null);
  const [text, setText] = useState("");
  const [tried, setTried] = useState(false);
  const current = useRef<Request | null>(null);

  const open = useCallback((p: Request) => {
    current.current = p;
    setText("");
    setTried(false);
    setRequest(p);
  }, []);
  const close = (answer: boolean) => {
    const p = current.current;
    current.current = null;
    setRequest(null);
    if (!p) return;
    if (p.kind === "confirm") p.resolve(answer);
    else p.resolve(answer ? text.trim() : null);
  };

  const confirm = useCallback(
    (c: Confirmation) => new Promise<boolean>((resolve) => open({ kind: "confirm", resolve, ...c })),
    [open],
  );
  const ask = useCallback(
    (p: Question) => new Promise<string | null>((resolve) => open({ kind: "ask", resolve, ...p })),
    [open],
  );

  const empty = request?.kind === "ask" && !text.trim();
  return (
    <Context.Provider value={{ confirm, ask }}>
      {children}
      <AlertDialog open={request !== null} onOpenChange={(open) => !open && close(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{request?.title}</AlertDialogTitle>
            {request?.description ? <AlertDialogDescription>{request.description}</AlertDialogDescription> : null}
          </AlertDialogHeader>
          {request?.kind === "ask" ? (
            <Field data-invalid={tried && empty ? true : undefined}>
              <FieldLabel htmlFor="dialogo-texto">{request.label}</FieldLabel>
              <Textarea
                id="dialogo-texto"
                autoFocus
                value={text}
                aria-invalid={(tried && empty) || undefined}
                onChange={(e) => setText(e.target.value)}
              />
              {tried && empty ? <FieldError>Escreva o motivo.</FieldError> : null}
            </Field>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              variant={request?.kind === "confirm" && request.danger ? "danger" : "primary"}
              onClick={() => {
                if (empty) return setTried(true);
                close(true);
              }}
            >
              {request?.action ?? "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Context.Provider>
  );
}

function useDialogs() {
  const c = useContext(Context);
  if (!c) throw new Error("ProvedorDeDialogos ausente");
  return c;
}

/** Diálogo "tem certeza?"; resolve true só no botão de ação. */
export const useConfirm = () => useDialogs().confirm;
/** Diálogo com campo de texto obrigatório (ex.: motivo); resolve null se voltar. */
export const useAsk = () => useDialogs().ask;
