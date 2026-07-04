import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const elevatedPress =
  "box-border active:not-aria-[haspopup]:not-disabled:border-b-0 active:not-aria-[haspopup]:not-disabled:border-t-4 active:not-aria-[haspopup]:not-disabled:border-t-transparent active:not-aria-[haspopup]:transition-none";

const buttonVariants = cva(
  "group/button box-border inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-colors duration-150 outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:bg-gray-100 disabled:text-gray-400 disabled:border-b-0 disabled:border-gray-200 disabled:text-gray-400 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: cn(
          "bg-primary text-primary-foreground hover:bg-primary-400 active:bg-primary border border-transparent border-b-4 border-b-primary-700 aria-expanded:bg-primary-400 aria-expanded:text-primary-foreground",
          elevatedPress,
        ),
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary: cn(
          "bg-white text-primary-400 hover:bg-gray-50 active:bg-white aria-expanded:bg-secondary aria-expanded:text-secondary-foreground border border-transparent border-b-4 border-b-gray-100",
          elevatedPress,
        ),
        ghost:
          "text-primary hover:bg-gray-50 aria-expanded:bg-gray-50 aria-expanded:text-primary disabled:bg-transparent disabled:border-none",
        destructive: cn(
          "bg-destructive text-white hover:bg-red-400 active:bg-destructive focus-visible:border-red-300 focus-visible:ring-red-400 dark:bg-red-400 dark:hover:bg-red-400 dark:active:bg-red-400 dark:focus-visible:ring-red-300 border border-transparent border-b-4 border-b-red-700",
          elevatedPress,
        ),
        link: "text-primary underline-offset-4 hover:underline disabled:bg-transparent disabled:border-none",
        success: cn(
          "bg-green-500 text-white hover:bg-green-400 active:bg-green-500 border border-transparent border-b-4 border-b-green-700 aria-expanded:bg-green-400 aria-expanded:text-white",
          elevatedPress,
        ),
      },
      size: {
        default:
          "h-11 min-w-28 font-bold text-base tracking-[0.2px] h-11 py-3 px-8 leading-4 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return <ButtonPrimitive data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
