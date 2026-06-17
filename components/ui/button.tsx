import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-md border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap shadow-xs transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px active:not-aria-[haspopup]:duration-75 disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-45 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 motion-reduce:transition-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-[color-mix(in_oklch,var(--primary),var(--foreground)_14%)] hover:shadow-sm dark:hover:bg-[color-mix(in_oklch,var(--primary),var(--background)_10%)]",
        outline:
          "border-border/80 bg-background/80 text-foreground hover:border-primary/30 hover:bg-[color-mix(in_oklch,var(--secondary),var(--background)_42%)] hover:text-foreground aria-expanded:border-primary/30 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground dark:border-input dark:bg-input/30 dark:hover:border-primary/40 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_7%)] hover:shadow-sm aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "bg-transparent shadow-none hover:bg-secondary/80 hover:text-foreground aria-expanded:bg-secondary aria-expanded:text-secondary-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive text-white hover:bg-[color-mix(in_oklch,var(--destructive),var(--foreground)_12%)] hover:shadow-sm focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:text-background dark:hover:bg-[color-mix(in_oklch,var(--destructive),var(--background)_10%)] dark:focus-visible:ring-destructive/40",
        link:
          "border-transparent bg-transparent text-primary shadow-none underline-offset-4 hover:bg-transparent hover:text-[color-mix(in_oklch,var(--primary),var(--foreground)_18%)] hover:underline focus-visible:ring-2",
      },
      size: {
        default:
          "h-9 gap-1.5 px-2.5 in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),8px)] px-2 text-xs in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1 rounded-[min(var(--radius-md),10px)] px-2.5 in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5",
        lg: "h-10 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-9",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),8px)] in-data-[slot=button-group]:rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-8 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-md",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  nativeButton,
  render,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      nativeButton={render ? nativeButton : true}
      render={render}
      {...props}
    />
  )
}

export { Button, buttonVariants }
