import { Button as ButtonPrimitive } from "@base-ui/react/button";
import type { TamanhoPainel, Variante } from "@fila-saude/design";
import { Loader2Icon, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type { TamanhoPainel, Variante };

type Props = Omit<ButtonPrimitive.Props, "className"> & {
  variante?: Variante;
  tamanho?: TamanhoPainel;
  /** Ícone à esquerda do rótulo (ou sozinho, no tamanho "icone"). */
  icone?: LucideIcon;
  /** Ação em andamento: não aceita clique, avisa o leitor de tela e mostra "Aguarde…". */
  carregando?: boolean;
  /** Só para layout (largura, margem, posição): a aparência vem do design system. */
  className?: string;
};

/**
 * O botão do design system (portal do iFood, relevo leve): um componente para todas as ações do
 * painel. Variações e medidas vêm de `@fila-saude/design` (classes `.ds-btn-*` do `tokens.css`),
 * as mesmas do `Botao` do app.
 */
function Button({
  variante = "principal",
  tamanho = "padrao",
  icone: Icone,
  carregando = false,
  disabled,
  className,
  children,
  ...props
}: Props) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn("ds-btn", `ds-btn-${variante}`, `ds-btn-${tamanho}`, className)}
      disabled={disabled || carregando}
      aria-busy={carregando || undefined}
      {...props}
    >
      {carregando ? (
        <Loader2Icon className="size-4 animate-spin" aria-hidden />
      ) : Icone ? (
        <Icone className="size-4" aria-hidden />
      ) : null}
      {carregando ? <span>Aguarde…</span> : typeof children === "string" ? <span>{children}</span> : children}
    </ButtonPrimitive>
  );
}

export { Button };
