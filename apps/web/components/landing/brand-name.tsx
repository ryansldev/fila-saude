import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

interface BrandNameProps {
  className?: string;
  logoClassName?: string;
  textClassName?: string;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: {
    gap: "gap-1.5",
    logo: "size-5",
    text: "text-xs font-bold",
  },
  md: {
    gap: "gap-2.5",
    logo: "size-9",
    text: "text-xl font-extrabold tracking-tight",
  },
  lg: {
    gap: "gap-2.5",
    logo: "size-10 sm:size-11",
    text: "text-3xl font-extrabold tracking-tight sm:text-4xl",
  },
} as const;

export function BrandName({ className, logoClassName, textClassName, size = "md" }: BrandNameProps) {
  const styles = sizeClasses[size];

  return (
    <span className={cn("inline-flex items-center", styles.gap, className)}>
      <Logo className={cn(styles.logo, "shrink-0 text-primary", logoClassName)} />
      <span className={cn(styles.text, "lowercase text-gray-900", textClassName)}>fila saúde</span>
    </span>
  );
}
