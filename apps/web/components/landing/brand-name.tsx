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
    logo: "size-11 sm:size-12",
    text: "text-[2.0625rem] font-extrabold tracking-tight sm:text-[2.475rem]",
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
