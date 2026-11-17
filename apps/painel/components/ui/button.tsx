import { Button as ButtonPrimitive } from "@base-ui/react/button";
import type { PanelSize, Variant } from "@fila-saude/design";
import { Loader2Icon, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type { PanelSize, Variant };

type Props = Omit<ButtonPrimitive.Props, "className"> & {
  variant?: Variant;
  size?: PanelSize;
  /** Ícone à esquerda do rótulo (ou sozinho, no tamanho "icone"). */
  icon?: LucideIcon;
  /** Ação em andamento: não aceita clique, avisa o leitor de tela e mostra "Aguarde…". */
  loading?: boolean;
  /** Só para layout (largura, margem, posição): a aparência vem do design system. */
  className?: string;
};

/**
 * O botão do design system (portal do iFood, relevo leve): um componente para todas as ações do
 * painel. Variações e medidas vêm de `@fila-saude/design` (classes `.ds-btn-*` do `tokens.css`),
 * as mesmas do `Botao` do app.
 */
function Button({
  variant = "primary",
  size = "default",
  icon: Icon,
  loading = false,
  disabled,
  className,
  children,
  ...props
}: Props) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn("ds-btn", `ds-btn-${variant}`, `ds-btn-${size}`, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <Loader2Icon className="size-4 animate-spin" aria-hidden />
      ) : Icon ? (
        <Icon className="size-4" aria-hidden />
      ) : null}
      {loading ? <span>Aguarde…</span> : typeof children === "string" ? <span>{children}</span> : children}
    </ButtonPrimitive>
  );
}

export { Button };
